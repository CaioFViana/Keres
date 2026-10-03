import { deflate } from 'pako';
import type { CompiledManuscript, ManuscriptRenderOptions } from './manuscriptCompiler';
import {
  iterateRuns,
  pdfGeometry,
  paginateStream,
  sameAnchorPages,
  widthOfTextAtSize,
  winAnsiByte,
  type LineRun,
  type ManuscriptPdfLabels,
  type PdfAnchor,
  type PdfFont,
  type PdfGeometry,
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
  // Typed chunks: a book of tens of megabytes must not cost a JS number per byte.
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [];
  private length = 0;
  // Coalesced ascii: thousands of tiny dictionary writes share one buffer
  // instead of one Uint8Array each. Flushed before anything position- or
  // order-sensitive (offsets, binary, snapshot), so byte order never changes.
  private pending = '';

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  private flush(): void {
    if (this.pending === '') return;
    const text = this.pending;
    this.pending = '';
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index] = text.charCodeAt(index) & 0xff;
    }
    this.push(bytes);
  }

  ascii(text: string): void {
    this.pending += text;
  }

  raw(bytes: Uint8Array): void {
    this.flush();
    this.push(bytes);
  }

  snapshot(): Uint8Array {
    this.flush();
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  literal(text: string): void {
    this.flush();
    this.push(Uint8Array.from([0x28, ...escapeLiteral(text), 0x29]));
  }

  object(body: (writer: PdfWriter) => void): number {
    this.flush();
    const id = this.offsets.length + 1;
    this.offsets.push(this.length);
    this.ascii(`${id} 0 obj\n`);
    body(this);
    this.ascii(`endobj\n`);
    return id;
  }

  finish(rootId: number, infoId: number): Uint8Array {
    this.flush();
    const xrefAt = this.length;
    this.ascii(`xref\n0 ${this.offsets.length + 1}\n0000000000 65535 f \n`);
    for (const offset of this.offsets) {
      this.ascii(`${String(offset).padStart(10, '0')} 00000 n \n`);
    }
    this.ascii(
      `trailer\n<< /Size ${this.offsets.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    );
    this.flush();
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

function drawLine(run: LineRun, y: number, writer: PdfWriter, geometry: PdfGeometry): void {
  const fontIndex = (font: PdfFont): number => FONT_KEYS.indexOf(font) + 1;
  let x = geometry.margin + run.indent;
  if (run.centered) {
    const width = run.words.reduce((sum, word) => sum + word.width, 0);
    const gaps = run.words
      .slice(1)
      .reduce((sum, word) => sum + widthOfTextAtSize(' ', word.font, run.size), 0);
    x = geometry.margin + (geometry.contentWidth - (width + gaps)) / 2;
  }
  const gray = run.gray.toFixed(2);
  const placed: { word: Word; x: number }[] = [];
  // A line is one text object: the words are set as consecutive strings of one font, the spaces
  // between them inside the strings (each word's leading space is drawn in the word's own face,
  // exactly the advance the layout counted), so the viewer places every glyph itself. Only a
  // change of face starts a new string.
  const segments: { font: PdfFont; text: string }[] = [];
  run.words.forEach((word, index) => {
    if (index > 0) x += widthOfTextAtSize(' ', word.font, run.size);
    placed.push({ word, x });
    x += word.width;
    const last = segments[segments.length - 1];
    const piece = (index > 0 ? ' ' : '') + word.text;
    if (last && last.font === word.font) last.text += piece;
    else segments.push({ font: word.font, text: piece });
  });
  if (segments.length > 0) {
    writer.ascii(`BT ${gray} g 1 0 0 1 ${trim(placed[0].x)} ${trim(y - run.size)} Tm`);
    for (const segment of segments) {
      writer.ascii(` /F${fontIndex(segment.font)} ${trim(run.size)} Tf `);
      writer.literal(segment.text);
      writer.ascii(' Tj');
    }
    writer.ascii(' ET\n');
  }
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

type TocAnnot = { pageIndex: number; rect: number[]; destPageIndex: number; destY: number };

/** One layout of the whole book: the bytes of every page, and where every heading landed. */
type LaidPass = {
  streams: Uint8Array[];
  annots: TocAnnot[];
  anchors: Map<string, PdfAnchor>;
};

/**
 * Lays the book out once. Each page is drawn into its bytes the moment it is full and the lines
 * that made it are dropped, so what stays in memory is the finished pages (about the size of the
 * file) and never the lines of the whole book. Index links can only be aimed once the pass has
 * seen every heading, so they are kept as bare positions until then.
 */
function layoutPass(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  anchors: Map<string, PdfAnchor>,
  options: ManuscriptRenderOptions,
  geometry: PdfGeometry,
): LaidPass {
  const streams: Uint8Array[] = [];
  const links: { pageIndex: number; rect: number[]; target: string }[] = [];
  const { anchors: found } = paginateStream(
    iterateRuns(manuscript, labels, anchors, options),
    geometry,
    (page, pageIndex) => {
      const content = new PdfWriter();
      for (const { run, y } of page) {
        drawLine(run, y, content, geometry);
        if (run.linkTarget) {
          links.push({
            pageIndex,
            rect: [
              geometry.margin,
              y - run.leading + 2,
              geometry.margin + geometry.contentWidth,
              y,
            ],
            target: run.linkTarget,
          });
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
        geometry.footerY + 9,
        content,
        geometry,
      );
      streams.push(content.snapshot());
    },
  );
  const annots: TocAnnot[] = [];
  for (const link of links) {
    const anchor = found.get(link.target);
    if (anchor) {
      annots.push({
        pageIndex: link.pageIndex,
        rect: link.rect,
        destPageIndex: anchor.page - 1,
        destY: anchor.y,
      });
    }
  }
  return { streams, annots, anchors: found };
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
  const geometry = pdfGeometry(options);
  let anchors = new Map<string, PdfAnchor>();
  let laid: LaidPass | null = null;
  for (let pass = 0; pass < 3; pass += 1) {
    laid = layoutPass(manuscript, labels, anchors, options, geometry);
    if (sameAnchorPages(anchors, laid.anchors)) {
      anchors = laid.anchors;
      break;
    }
    anchors = laid.anchors;
  }
  const { streams, annots } = laid!;
  laid = null;
  const pageCount = streams.length;
  // Page content streams ride deflated (`/Filter /FlateDecode`): the same
  // drawing commands at roughly a tenth of the bytes, so a novel-length book
  // stays far from the manuscript size cap. `pako` is pure JS with no
  // platform imports, like every other dependency of this renderer.
  // Each raw page is released right after its own compression, so the raw
  // (~1.7x the text) and deflated copies never sit side by side in full.
  const compressed: Uint8Array[] = new Array(pageCount);
  for (let index = 0; index < pageCount; index += 1) {
    compressed[index] = deflate(streams[index]);
    streams[index] = new Uint8Array(0);
  }

  const writer = new PdfWriter();
  writer.ascii('%PDF-1.7\n');
  const catalogId = writer.object((body) => {
    body.ascii('<< /Type /Catalog /Pages 2 0 R >>\n');
  });
  // Link annotations take ids 3.., then pages and contents alternate from
  // firstPageId on, so every id below stays arithmetic.
  const firstPageId = 3 + annots.length;
  const kids = streams.map((_, index) => `${firstPageId + 2 * index} 0 R`).join(' ');
  const pagesId = writer.object((body) => {
    body.ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\n`);
  });
  const annotIdsByPage: number[][] = streams.map(() => []);
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
  const fontBase = firstPageId + 2 * pageCount;
  compressed.forEach((page, index) => {
    const contentId = firstPageId + 2 * index + 1;
    const annotRefs = annotIdsByPage[index].map((id) => `${id} 0 R`).join(' ');
    const annotsEntry = annotRefs === '' ? '' : ` /Annots [${annotRefs}]`;
    writer.object((body) => {
      body.ascii(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${geometry.pageWidth} ${geometry.pageHeight}]` +
          ` /Contents ${contentId} 0 R${annotsEntry} /Resources << /Font <<` +
          ` /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R` +
          ` /F3 ${fontBase + 2} 0 R /F4 ${fontBase + 3} 0 R >> >> >>\n`,
      );
    });
    writer.object((body) => {
      body.ascii(`<< /Length ${page.length} /Filter /FlateDecode >>\nstream\n`);
      body.raw(page);
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
