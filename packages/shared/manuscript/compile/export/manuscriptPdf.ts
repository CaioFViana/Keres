import type { CompiledManuscript, ManuscriptRenderOptions } from './manuscriptCompiler';
import {
  CONTENT_WIDTH,
  FOOTER_Y,
  MARGIN,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  flattenRuns,
  paginate,
  sameAnchorPages,
  widthOfTextAtSize,
  winAnsiByte,
  type LineRun,
  type ManuscriptPdfLabels,
  type PdfAnchor,
  type PdfFont,
  type PlacedRun,
  type Word,
} from './manuscriptPdfLayout';

export type { ManuscriptPdfLabels } from './manuscriptPdfLayout';

/** PDF base-font names for the four Times faces. */
const FONT_NAMES: Record<PdfFont, string> = {
  times: 'Times-Roman',
  'times-bold': 'Times-Bold',
  'times-italic': 'Times-Italic',
  'times-bolditalic': 'Times-BoldOblique',
};

const FONT_KEYS: PdfFont[] = ['times', 'times-bold', 'times-italic', 'times-bolditalic'];

function escapeLiteral(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    if (char === '(' || char === ')' || char === '\\') bytes.push(0x5c);
    bytes.push(winAnsiByte(char));
  }
  return bytes;
}

/**
 * UTF-16BE with BOM for document metadata: page bytes are WinAnsi (the
 * standard-font constraint), but Info strings may carry the full title —
 * accents, quotes, even emoji — so they get the encoding readers expect.
 */
function utf16beHex(text: string): string {
  const bytes: number[] = [0xfe, 0xff];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f;
    if (code > 0xffff) {
      const value = code - 0x10000;
      const high = 0xd800 + (value >> 10);
      const low = 0xdc00 + (value & 0x3ff);
      bytes.push(high >> 8, high & 0xff, low >> 8, low & 0xff);
    } else {
      bytes.push(code >> 8, code & 0xff);
    }
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('');
}

class PdfWriter {
  private chunks: number[][] = [];
  private offsets: number[] = [];
  private length = 0;

  private push(bytes: number[]): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  ascii(text: string): void {
    const bytes: number[] = [];
    for (let index = 0; index < text.length; index += 1) {
      bytes.push(text.charCodeAt(index) & 0xff);
    }
    this.push(bytes);
  }

  raw(bytes: Uint8Array): void {
    this.push(Array.from(bytes));
  }

  snapshot(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  literal(text: string): void {
    this.push([0x28, ...escapeLiteral(text), 0x29]);
  }

  object(body: (writer: PdfWriter) => void): number {
    const id = this.offsets.length + 1;
    this.offsets.push(this.length);
    this.ascii(`${id} 0 obj\n`);
    body(this);
    this.ascii(`endobj\n`);
    return id;
  }

  finish(rootId: number, infoId: number): Uint8Array {
    const xrefAt = this.length;
    this.ascii(`xref\n0 ${this.offsets.length + 1}\n0000000000 65535 f \n`);
    for (const offset of this.offsets) {
      this.ascii(`${String(offset).padStart(10, '0')} 00000 n \n`);
    }
    this.ascii(
      `trailer\n<< /Size ${this.offsets.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    );
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

function drawLine(run: LineRun, y: number, writer: PdfWriter): void {
  const fontIndex = (font: PdfFont): number => FONT_KEYS.indexOf(font) + 1;
  let x = MARGIN + run.indent;
  if (run.centered) {
    const width = run.words.reduce((sum, word) => sum + word.width, 0);
    const gaps = run.words
      .slice(1)
      .reduce((sum, word) => sum + widthOfTextAtSize(' ', word.font, run.size), 0);
    x = MARGIN + (CONTENT_WIDTH - (width + gaps)) / 2;
  }
  const gray = run.gray.toFixed(2);
  const placed: { word: Word; x: number }[] = [];
  run.words.forEach((word, index) => {
    if (index > 0) x += widthOfTextAtSize(' ', word.font, run.size);
    placed.push({ word, x });
    writer.ascii(
      `BT /F${fontIndex(word.font)} ${trim(run.size)} Tf ${gray} g 1 0 0 1 ${trim(x)} ${trim(y - run.size)} Tm `,
    );
    writer.literal(word.text);
    writer.ascii(' Tj ET\n');
    x += word.width;
  });
  // Decoration rules, grouped over contiguous marked words so a multi-word
  // underline reads as one stroke instead of breaking at every space.
  const rules: { flag: 'underline' | 'strikethrough'; from: number; to: number }[] = [];
  const collect = (flag: 'underline' | 'strikethrough') => {
    let group: { from: number; to: number } | null = null;
    const flush = () => {
      if (group) rules.push({ flag, ...group });
      group = null;
    };
    for (const { word, x } of placed) {
      if (word[flag]) {
        if (group) group.to = x + word.width;
        else group = { from: x, to: x + word.width };
      } else {
        flush();
      }
    }
    flush();
  };
  collect('underline');
  collect('strikethrough');
  if (rules.length > 0) {
    const baseline = y - run.size;
    const thickness = Math.max(0.4, run.size * 0.05);
    writer.ascii(`${gray} g\n`);
    for (const rule of rules) {
      const ruleY =
        rule.flag === 'underline'
          ? baseline - run.size * 0.1 - thickness
          : baseline + run.size * 0.25 - thickness / 2;
      writer.ascii(
        `${trim(rule.from)} ${trim(ruleY)} ${trim(rule.to - rule.from)} ${trim(thickness)} re f\n`,
      );
    }
  }
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * The compiled manuscript as real PDF bytes, laid out and serialized in pure
 * TypeScript - no native print pipeline, no third-party PDF dependency (the app
 * bundles for web through Metro, which must never see one here).
 *
 * The renderer knows its own pagination, so choice cross-references carry true
 * "page N" numbers and every page gets a footer counter. Chapters open a new
 * page, like the print stylesheet; headings keep with the line that follows
 * them. Page numbers settle over at most three layout passes: resolving them
 * lengthens choices, which can in principle move the very anchors they point at.
 * The optional index lists every heading with its page and a link annotation
 * jumping straight to it.
 */
export function buildManuscriptPdf(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  options: ManuscriptRenderOptions = {},
): Uint8Array {
  let anchors = new Map<string, PdfAnchor>();
  let pages: PlacedRun[][] = [[]];
  for (let pass = 0; pass < 3; pass += 1) {
    const laid = paginate(flattenRuns(manuscript, labels, anchors, options));
    pages = laid.pages;
    if (sameAnchorPages(anchors, laid.anchors)) {
      anchors = laid.anchors;
      break;
    }
    anchors = laid.anchors;
  }

  type TocAnnot = { pageIndex: number; rect: number[]; destPageIndex: number; destY: number };
  const annots: TocAnnot[] = [];
  const streams = pages.map((runs, pageIndex) => {
    const content = new PdfWriter();
    for (const { run, y } of runs) {
      drawLine(run, y, content);
      if (run.linkTarget) {
        const anchor = anchors.get(run.linkTarget);
        if (anchor) {
          annots.push({
            pageIndex,
            rect: [MARGIN, y - run.leading + 2, MARGIN + CONTENT_WIDTH, y],
            destPageIndex: anchor.page - 1,
            destY: anchor.y,
          });
        }
      }
    }
    const label = `${pageIndex + 1}`;
    drawLine(
      {
        words: [
          {
            text: label,
            font: 'times',
            width: widthOfTextAtSize(label, 'times', 9),
            underline: false,
            strikethrough: false,
          },
        ],
        size: 9,
        leading: 9,
        indent: 0,
        spaceBefore: 0,
        spaceAfter: 0,
        centered: true,
        gray: 0.53,
        bookmarkId: null,
        linkTarget: null,
        keepWithNext: false,
        forcePageBreak: false,
      },
      FOOTER_Y + 9,
      content,
    );
    return content.snapshot();
  });

  const writer = new PdfWriter();
  writer.ascii('%PDF-1.7\n');
  const catalogId = writer.object((body) => {
    body.ascii('<< /Type /Catalog /Pages 2 0 R >>\n');
  });
  // Link annotations take ids 3.., then pages and contents alternate from
  // firstPageId on, so every id below stays arithmetic.
  const firstPageId = 3 + annots.length;
  const kids = pages.map((_, index) => `${firstPageId + 2 * index} 0 R`).join(' ');
  const pagesId = writer.object((body) => {
    body.ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\n`);
  });
  const annotIdsByPage: number[][] = pages.map(() => []);
  annots.forEach((annot) => {
    const id = writer.object((body) => {
      const destPageId = firstPageId + 2 * annot.destPageIndex;
      body.ascii(
        `<< /Type /Annot /Subtype /Link /Rect [${annot.rect.map(trim).join(' ')}]` +
          ` /Border [0 0 0] /Dest [${destPageId} 0 R /XYZ null ${trim(annot.destY)} null] >>\n`,
      );
    });
    annotIdsByPage[annot.pageIndex].push(id);
  });
  const fontBase = firstPageId + 2 * pages.length;
  pages.forEach((_, index) => {
    const contentId = firstPageId + 2 * index + 1;
    const annotRefs = annotIdsByPage[index].map((id) => `${id} 0 R`).join(' ');
    const annotsEntry = annotRefs === '' ? '' : ` /Annots [${annotRefs}]`;
    writer.object((body) => {
      body.ascii(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]` +
          ` /Contents ${contentId} 0 R${annotsEntry} /Resources << /Font <<` +
          ` /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R` +
          ` /F3 ${fontBase + 2} 0 R /F4 ${fontBase + 3} 0 R >> >> >>\n`,
      );
    });
    writer.object((body) => {
      body.ascii(`<< /Length ${streams[index].length} >>\nstream\n`);
      body.raw(streams[index]);
      body.ascii('endstream\n');
    });
  });
  FONT_KEYS.forEach((font) => {
    writer.object((body) => {
      body.ascii(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[font]} /Encoding /WinAnsiEncoding >>\n`,
      );
    });
  });
  const infoId = writer.object((body) => {
    body.ascii(`<< /Title <${utf16beHex(manuscript.title)}>`);
    body.ascii(' /Producer ');
    body.literal('Keres');
    body.ascii(' >>\n');
  });
  return writer.finish(catalogId, infoId);
}
