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
  type PdfMeasure,
  type Word,
} from './manuscriptPdfLayout';
import { loadPdfFontPack, type PdfFontMatrices, type PdfFontPack } from './manuscriptPdfFonts';
import { assertWithinManuscriptLimit } from '../manuscriptSize';
import { planPdfImages } from './manuscriptPdfImages';

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
    // A book already past the limit stops here, page by page, instead of finishing a file to throw away.
    assertWithinManuscriptLimit(this.length);
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

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
}

function drawLine(
  run: LineRun,
  y: number,
  writer: PdfWriter,
  geometry: PdfGeometry,
  measure: PdfMeasure = widthOfTextAtSize,
  pack: PdfFontPack | null = null,
): void {
  const fontIndex = (font: PdfFont): number => FONT_KEYS.indexOf(font) + 1;
  // Base faces ride /F1../F4; CJK matrices add /F5../F8 in the same face order.
  const resourceOf = (font: PdfFont, cjk: boolean): number =>
    fontIndex(font) + (cjk ? FONT_KEYS.length : 0);
  let x = geometry.margin + run.indent;
  if (run.centered) {
    const width = run.words.reduce((sum, word) => sum + word.width, 0);
    const gaps = run.words
      .slice(1)
      .reduce((sum, word) => sum + measure(' ', word.font, run.size), 0);
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
    if (index > 0) x += measure(' ', word.font, run.size);
    placed.push({ word, x });
    x += word.width;
    const last = segments[segments.length - 1];
    const piece = (index > 0 ? ' ' : '') + word.text;
    if (last && last.font === word.font) last.text += piece;
    else segments.push({ font: word.font, text: piece });
  });
  if (segments.length > 0) {
    // Glyph collection happens on the anchor-settling passes, never here: by
    // emit time the subset is finished and `cidOf` resolves.
    writer.ascii(`BT ${gray} g 1 0 0 1 ${trim(placed[0].x)} ${trim(y - run.size)} Tm`);
    for (const segment of segments) {
      if (pack) {
        // Identity-H: two bytes per glyph, resolved after the final pass; a
        // mixed-script segment splits into one string per matrix (/F1../F8).
        for (const part of pack.splitRuns(segment.font, segment.text)) {
          writer.ascii(` /F${resourceOf(segment.font, part.cjk)} ${trim(run.size)} Tf `);
          writer.ascii(
            `<${[...part.text].map((char) => hex4(pack.cidOf(segment.font, char))).join('')}>`,
          );
          writer.ascii(' Tj');
        }
      } else {
        writer.ascii(` /F${fontIndex(segment.font)} ${trim(run.size)} Tf `);
        writer.literal(segment.text);
        writer.ascii(' Tj');
      }
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

/** A page's picture: drawn in its frame, cropped to it when it fills the frame. */
function drawPicture(
  run: LineRun,
  y: number,
  writer: PdfWriter,
  geometry: PdfGeometry,
  imageIndex: number,
): void {
  const picture = run.image!;
  const left = geometry.margin + (geometry.contentWidth - picture.frameWidth) / 2;
  const bottom = y - picture.frameHeight;
  writer.ascii('q ');
  if (picture.clip) {
    writer.ascii(
      `${trim(left)} ${trim(bottom)} ${trim(picture.frameWidth)} ${trim(picture.frameHeight)} re W n `,
    );
  }
  writer.ascii(
    `${trim(picture.width)} 0 0 ${trim(picture.height)} ${trim(left + picture.dx)} ${trim(bottom + picture.dy)} cm /Im${imageIndex} Do Q\n`,
  );
}

type TocAnnot = { pageIndex: number; rect: number[]; destPageIndex: number; destY: number };

/** One layout of the whole book: the bytes of every page, and where every heading landed. */
type LaidPass = {
  streams: Uint8Array[];
  annots: TocAnnot[];
  anchors: Map<string, PdfAnchor>;
  /** The pictures drawn, by the number their `/Im` name carries (1-based, first use first). */
  imageOrder: Map<string, number>;
  /** For each page, the numbers of the pictures it draws. */
  pageImages: number[][];
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
  measure: PdfMeasure = widthOfTextAtSize,
  pack: PdfFontPack | null = null,
  emit = true,
): LaidPass {
  const streams: Uint8Array[] = [];
  const imageOrder = new Map<string, number>();
  const pageImages: number[][] = [];
  const links: { pageIndex: number; rect: number[]; target: string }[] = [];
  const { anchors: found } = paginateStream(
    iterateRuns(manuscript, labels, anchors, options, measure),
    geometry,
    (page, pageIndex) => {
      if (!emit) {
        // Anchor-settling pass: no bytes, but every drawn word's glyphs join
        // the subset, so `finish()` below sees the whole book. Spaces ride
        // inside drawn segments (collected explicitly here); the footer
        // counter never reaches a writer on these passes, so its digits are
        // collected explicitly too.
        if (pack) {
          for (const { run } of page) {
            for (const word of run.words) {
              pack.collect(word.font, word.text);
              pack.collect(word.font, ' ');
            }
          }
          pack.collect('times', `${pageIndex + 1}`);
        }
        return;
      }
      const content = new PdfWriter();
      const drawn = new Set<number>();
      for (const { run, y } of page) {
        if (run.image) {
          if (!imageOrder.has(run.image.mediaId)) {
            imageOrder.set(run.image.mediaId, imageOrder.size + 1);
          }
          const index = imageOrder.get(run.image.mediaId)!;
          drawn.add(index);
          drawPicture(run, y, content, geometry, index);
          continue;
        }
        drawLine(run, y, content, geometry, measure, pack);
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
              width: measure(label, 'times', 9),
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
        measure,
        pack,
      );
      streams.push(content.snapshot());
      pageImages.push([...drawn]);
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
  return { streams, annots, anchors: found, imageOrder, pageImages };
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
  const { streams, annots, imageOrder, pageImages } = laid!;
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
  // The pictures follow the four faces and the info dictionary.
  const imagePlan = planPdfImages(manuscript.images, imageOrder, fontBase + FONT_KEYS.length + 1);
  compressed.forEach((page, index) => {
    const contentId = firstPageId + 2 * index + 1;
    const annotRefs = annotIdsByPage[index].map((id) => `${id} 0 R`).join(' ');
    const annotsEntry = annotRefs === '' ? '' : ` /Annots [${annotRefs}]`;
    writer.object((body) => {
      body.ascii(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${geometry.pageWidth} ${geometry.pageHeight}]` +
          ` /Contents ${contentId} 0 R${annotsEntry} /Resources << /Font <<` +
          ` /F1 ${fontBase} 0 R /F2 ${fontBase + 1} 0 R` +
          ` /F3 ${fontBase + 2} 0 R /F4 ${fontBase + 3} 0 R >>${imagePlan.resources(pageImages[index])} >> >>\n`,
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
  imagePlan.write(writer);
  return writer.finish(catalogId, infoId);
}

/**
 * The manuscript as PDF with the platform's serif embedded as per-face
 * subsets (Identity-H + ToUnicode), so any Unicode the matrices cover draws
 * instead of degrading to `?`. Layout measures with the same advances the
 * subset carries; anchor-settling passes collect glyphs without emitting
 * bytes, the subset is finished once, and a final pass draws with resolved
 * CIDs. Font objects land after the pages (the xref resolves by offset, so
 * file order never matters) - five per face: Type0, CIDFontType2, descriptor,
 * ToUnicode, and the deflated subset stream.
 */
export async function buildManuscriptPdfAsync(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  options: ManuscriptRenderOptions,
  matrices: PdfFontMatrices,
): Promise<Uint8Array> {
  const pack = await loadPdfFontPack(matrices);
  const measure: PdfMeasure = (text, font, size) => pack.measure(text, font, size);
  const geometry = pdfGeometry(options);
  let anchors = new Map<string, PdfAnchor>();
  for (let pass = 0; pass < 3; pass += 1) {
    const settled = layoutPass(
      manuscript,
      labels,
      anchors,
      options,
      geometry,
      measure,
      pack,
      false,
    );
    if (sameAnchorPages(anchors, settled.anchors)) {
      anchors = settled.anchors;
      break;
    }
    anchors = settled.anchors;
  }
  const faces = await pack.finish();
  const laid = layoutPass(manuscript, labels, anchors, options, geometry, measure, pack, true);
  const { streams, annots, imageOrder, pageImages } = laid;
  // TEMP-DIAG (corrupted-PDF investigation): structural dump of what the
  // writer is about to embed. Removed after diagnosis; never breaks export.
  try {
    const fingerprint = (bytes: Uint8Array): string => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < bytes.length; i += 1) {
        hash ^= bytes[i] ?? 0;
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16);
    };
    const stats = faces
      .map(
        (face) =>
          `${face.font}/${face.cjk ? 'cjk' : 'base'}:${face.subsetBytes.length}B` +
          `/${fingerprint(face.subsetBytes)}` +
          `/${face.widthRuns.length}runs/${face.widthRuns[0]?.first ?? '-'}` +
          `:[${face.widthRuns[0]?.advances.slice(0, 4).join(',') ?? ''}]`,
      )
      .join(' ');
    console.info(`[manuscript] pdf faces: ${stats}`);
    const head = Array.from(streams[0].slice(0, 900), (byte) => String.fromCharCode(byte)).join('');
    console.info(`[manuscript] pdf page0: ${head}`);
  } catch {
    // Diagnostics never break export.
  }
  const pageCount = streams.length;
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
  const firstPageId = 3 + annots.length;
  const kids = compressed.map((_, index) => `${firstPageId + 2 * index} 0 R`).join(' ');
  const pagesId = writer.object((body) => {
    body.ascii(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\n`);
  });
  const annotIdsByPage: number[][] = compressed.map(() => []);
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
  // /F1../F4 are the base faces, /F5../F8 the CJK faces when matrices carry
  // them - in `finish()` order, so the resource index always matches.
  const fontResources = faces
    .map((_, faceIndex) => ` /F${faceIndex + 1} ${fontBase + faceIndex * 5} 0 R`)
    .join('');
  // The pictures follow the faces and the info dictionary.
  const imagePlan = planPdfImages(manuscript.images, imageOrder, fontBase + faces.length * 5 + 1);
  compressed.forEach((page, index) => {
    const contentId = firstPageId + 2 * index + 1;
    const annotRefs = annotIdsByPage[index].map((id) => `${id} 0 R`).join(' ');
    const annotsEntry = annotRefs === '' ? '' : ` /Annots [${annotRefs}]`;
    writer.object((body) => {
      body.ascii(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${geometry.pageWidth} ${geometry.pageHeight}]` +
          ` /Contents ${contentId} 0 R${annotsEntry} /Resources << /Font <<${fontResources} >>${imagePlan.resources(pageImages[index])} >> >>\n`,
      );
    });
    writer.object((body) => {
      body.ascii(`<< /Length ${page.length} /Filter /FlateDecode >>\nstream\n`);
      body.raw(page);
      body.ascii('endstream\n');
    });
  });
  for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
    const face = faces[faceIndex];
    const base = fontBase + faceIndex * 5;
    const baseFont = `/${face.baseFontName}`;
    const widths = face.widthRuns
      .map((run) => `${run.first} [${run.advances.join(' ')}]`)
      .join(' ');
    const deflatedSubset = deflate(face.subsetBytes);
    face.subsetBytes = new Uint8Array(0);
    writer.object((body) => {
      body.ascii(
        `<< /Type /Font /Subtype /Type0 /BaseFont ${baseFont} /Encoding /Identity-H` +
          ` /DescendantFonts [${base + 1} 0 R] /ToUnicode ${base + 3} 0 R >>\n`,
      );
    });
    writer.object((body) => {
      body.ascii(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont ${baseFont}` +
          ` /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>` +
          ` /FontDescriptor ${base + 2} 0 R /DW 1000 /W [${widths}] >>\n`,
      );
    });
    writer.object((body) => {
      const [x1, y1, x2, y2] = face.descriptor.bbox;
      // Flags 32 (nonsymbolic Latin) for the base serif, 4 (symbolic) for CJK.
      body.ascii(
        `<< /Type /FontDescriptor /FontName ${baseFont} /Flags ${face.cjk ? 4 : 32}` +
          ` /FontBBox [${x1} ${y1} ${x2} ${y2}] /ItalicAngle ${face.descriptor.italicAngle}` +
          ` /Ascent ${face.descriptor.ascent} /Descent ${face.descriptor.descent}` +
          ` /CapHeight ${face.descriptor.capHeight} /StemV 80 /FontFile2 ${base + 4} 0 R >>\n`,
      );
    });
    writer.object((body) => {
      body.ascii(`<< /Length ${face.toUnicode.length} >>\nstream\n${face.toUnicode}\nendstream\n`);
    });
    writer.object((body) => {
      body.ascii(`<< /Length ${deflatedSubset.length} /Filter /FlateDecode >>\nstream\n`);
      body.raw(deflatedSubset);
      body.ascii('endstream\n');
    });
  }
  const infoId = writer.object((body) => {
    body.ascii(`<< /Title <${utf16beHex(manuscript.title)}>`);
    body.ascii(' /Producer ');
    body.literal('Keres');
    body.ascii(' >>\n');
  });
  imagePlan.write(writer);
  return writer.finish(catalogId, infoId);
}

/** How long a manuscript is on the page, and the page it was counted on - so the number can be read honestly. */
export type ManuscriptPageEstimate = {
  pages: number;
  pageSize: 'a4' | '6x9';
  /** Body size in points. */
  fontSize: number;
  /** Line height as a multiple of the body size. */
  lineSpacing: number;
  /** Margin on every side, in points. */
  marginPt: number;
  /** First-line indent in points; `0` for block paragraphs. */
  firstLineIndentPt: number;
};

/**
 * The page count of the PDF this manuscript would make, found by the very layout that makes it
 * (every line wrapped and placed, nothing written). Pictures are not drawn, so a book of pages is
 * counted as its text alone; Word re-flows its own way and may differ by a little.
 */
export function estimateManuscriptPages(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  options: ManuscriptRenderOptions = {},
): ManuscriptPageEstimate {
  const geometry = pdfGeometry(options);
  const { pageCount } = paginateStream(
    iterateRuns(manuscript, labels, new Map(), options),
    geometry,
    () => undefined,
  );
  return {
    pages: pageCount,
    pageSize: options.pageSize ?? 'a4',
    fontSize: geometry.bodySize,
    lineSpacing: options.lineSpacing ?? 1.5,
    marginPt: geometry.margin,
    firstLineIndentPt: geometry.firstLineIndent,
  };
}
