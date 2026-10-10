import { deflate } from 'pako';
import type { CompiledManuscript, ManuscriptRenderOptions } from './manuscriptCompiler';
import {
  pdfGeometry,
  widthOfTextAtSize,
  type ManuscriptPdfLabels,
  type PdfFont,
  type PdfGeometry,
  type PdfMeasure,
} from './manuscriptPdfLayout';
import { iterateRuns, paginateStream, sameAnchorPages, type PdfAnchor } from './manuscriptPdfRuns';
import { FONT_KEYS, PdfWriter, drawLine, drawPicture, trim, utf16beHex } from './manuscriptPdfDraw';
import { loadPdfFontPack, type PdfFontMatrices, type PdfFontPack } from './manuscriptPdfFonts';
import { planPdfImages } from './manuscriptPdfImages';

export type { ManuscriptPdfLabels } from './manuscriptPdfLayout';

/** PDF base-font names for the four Times faces. */
const FONT_NAMES: Record<PdfFont, string> = {
  times: 'Times-Roman',
  'times-bold': 'Times-Bold',
  'times-italic': 'Times-Italic',
  'times-bolditalic': 'Times-BoldOblique',
};

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
