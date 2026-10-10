import type { CompiledSpan, ManuscriptRenderOptions } from './manuscriptCompiler';
import type { ManuscriptImage } from '../../images/imageInfo';
import { pdfImageOf, type PdfImageData } from '../../images/pdfImage';
import { TIMES_WIDTHS, type TimesFontKey } from './timesWidths';

/**
 * Measurement, line layout and pagination behind the manuscript PDF: compiled blocks in,
 * positioned line runs out. The pass that turns blocks into lines and the page placement live
 * in `manuscriptPdfRuns.ts`; serialization (the `PdfWriter`, line drawing, the cross-reference
 * table) lives in `manuscriptPdfDraw.ts` and `manuscriptPdf.ts`. The dependency runs one way:
 * serializers above layout, nothing here imports them.
 */

export type ManuscriptPdfLabels = {
  /** Prefix of a choice reference, e.g. "Go to page" - the number is real, from layout. */
  goToPage: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/**
 * The page and the body a manuscript is set on. Both stages share it: layout wraps and paginates
 * against it, the serializer draws and links against it. The defaults are A4 with the print
 * stylesheet's 2cm margins and an 11pt body - the renderer's long-standing look; a trade
 * paperback is 6"x9" with 0.75" margins.
 */
export type PdfGeometry = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  topY: number;
  bottomY: number;
  footerY: number;
  bodySize: number;
  bodyLeading: number;
  firstLineIndent: number;
  /** Space after a paragraph. */
  paragraphGap: number;
};

const PAGE_SIZES = {
  a4: { pageWidth: 595.28, pageHeight: 841.89, margin: 56.7 },
  '6x9': { pageWidth: 432, pageHeight: 648, margin: 54 },
} as const;

export function pdfGeometry(options: ManuscriptRenderOptions = {}): PdfGeometry {
  const page = PAGE_SIZES[options.pageSize ?? 'a4'];
  const bodySize = options.fontSize ?? 11;
  const bodyLeading = bodySize * (options.lineSpacing ?? 1.5);
  const block = options.paragraphStyle === 'block';
  return {
    ...page,
    contentWidth: page.pageWidth - page.margin * 2,
    topY: page.pageHeight - page.margin,
    bottomY: page.margin,
    footerY: page.margin - 24,
    bodySize,
    bodyLeading,
    firstLineIndent: block ? 0 : 22,
    paragraphGap: block ? Math.round(bodyLeading * 0.6) : 7,
  };
}

/**
 * The manuscript is set in Times, one of PDF's fourteen standard fonts: no
 * embedding, no dependency, and the same serif face as the HTML export. The
 * standard fonts carry no metrics, so glyph widths come from the static
 * `TIMES_WIDTHS` table (Adobe AFM data) and layout sums them per character.
 */
export type PdfFont = TimesFontKey;

/**
 * Advance measurement. The default sums the static Times AFM table (the legacy
 * WinAnsi path); an embedded-font pack passes its own shaped measurer so
 * layout counts exactly what the subset font draws.
 */
export type PdfMeasure = (text: string, font: PdfFont, size: number) => number;

function fontFor(span: Pick<CompiledSpan, 'bold' | 'italic'>): PdfFont {
  if (span.bold && span.italic) return 'times-bolditalic';
  if (span.bold) return 'times-bold';
  if (span.italic) return 'times-italic';
  return 'times';
}

/** Proportional advance: every character summed from the AFM width table. */
export function widthOfTextAtSize(text: string, font: PdfFont, size: number): number {
  let total = 0;
  for (const char of text) {
    total += TIMES_WIDTHS[font][winAnsiByte(char)] / 1000;
  }
  return total * size;
}

/**
 * Windows-1252 extras (0x80-0x9F): printable in PDF's WinAnsi encoding though
 * outside Latin-1. Covers the punctuation the renderer itself emits (•, —)
 * plus the usual quotes and dashes a manuscript body may carry.
 */
const WIN_ANSI_EXTRAS = new Map<string, number>([
  ['€', 0x80],
  ['‚', 0x82],
  ['ƒ', 0x83],
  ['„', 0x84],
  ['…', 0x85],
  ['†', 0x86],
  ['‡', 0x87],
  ['ˆ', 0x88],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['˜', 0x98],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f],
]);

/** Anything WinAnsi cannot encode (emoji, CJK, ...) degrades to `?`, never throws. */
export function winAnsiByte(char: string): number {
  const extra = WIN_ANSI_EXTRAS.get(char);
  if (extra !== undefined) return extra;
  const code = char.codePointAt(0) ?? 0x3f;
  // Controls and DEL have no WinAnsi mapping (and no glyph): degrade as well.
  if (code < 0x20 || code === 0x7f) return 0x3f;
  if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) return code;
  return 0x3f;
}

export type Word = {
  text: string;
  font: PdfFont;
  width: number;
  underline: boolean;
  strikethrough: boolean;
};

/** One drawn line. Paragraphs and choices flatten to one or more of these. */
export type LineRun = {
  words: Word[];
  size: number;
  leading: number;
  indent: number;
  spaceBefore: number;
  spaceAfter: number;
  centered: boolean;
  gray: number;
  /** Set on a heading's first line only: the page it lands on resolves choices. */
  bookmarkId: string | null;
  /** Set on an index entry's first line only: clicking jumps to this anchor. */
  linkTarget: string | null;
  keepWithNext: boolean;
  forcePageBreak: boolean;
  /** A page's picture: this run draws it instead of words, and `leading` is the height of its frame. */
  image?: PdfPagePicture;
};

/**
 * Where a picture goes inside its run: the frame (full text width, `leading` tall) and the picture within
 * it, in points from the frame's bottom-left. `clip` crops what a `cover` picture spills outside the frame.
 */
export type PdfPagePicture = {
  mediaId: string;
  frameWidth: number;
  frameHeight: number;
  dx: number;
  dy: number;
  width: number;
  height: number;
  clip: boolean;
};

/**
 * A picture's PDF form, worked out once per picture however many pages and passes use it: the layout
 * asks for it to know whether the picture can be drawn, the serializer to write it. Keyed by the
 * manuscript's own picture table, so it lives exactly as long as the build that holds it.
 */
const PDF_IMAGES = new WeakMap<object, Map<string, PdfImageData | null>>();

export function pdfImageFor(
  images: Record<string, ManuscriptImage>,
  mediaId: string,
): PdfImageData | null {
  let cache = PDF_IMAGES.get(images);
  if (!cache) {
    cache = new Map();
    PDF_IMAGES.set(images, cache);
  }
  if (!cache.has(mediaId)) {
    const image = images[mediaId];
    cache.set(mediaId, image ? pdfImageOf(image) : null);
  }
  return cache.get(mediaId) ?? null;
}

/**
 * The frame a page's picture is placed in. It is as wide as the text and as tall as the frame's shape
 * makes it, shrunk (still in shape) so that, caption and all, it always fits a page of its own.
 */
export function pagePicturePlacement(
  image: { width: number; height: number },
  fit: 'contain' | 'cover',
  aspect: number,
  geometry: Pick<PdfGeometry, 'contentWidth' | 'topY' | 'bottomY'>,
  mediaId: string,
): PdfPagePicture {
  const room = geometry.topY - geometry.bottomY - 48;
  let frameWidth = geometry.contentWidth;
  let frameHeight = frameWidth / aspect;
  if (frameHeight > room) {
    frameHeight = room;
    frameWidth = frameHeight * aspect;
  }
  const scale =
    fit === 'cover'
      ? Math.max(frameWidth / image.width, frameHeight / image.height)
      : Math.min(frameWidth / image.width, frameHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    mediaId,
    frameWidth,
    frameHeight,
    dx: (frameWidth - width) / 2,
    dy: (frameHeight - height) / 2,
    width,
    height,
    clip: fit === 'cover',
  };
}

/**
 * Zero-width joiners are not `\s`, so the word splitter would keep them and
 * WinAnsi would print them as `?`. Stripped before layout, they cost no width.
 */
const ZERO_WIDTH_PATTERN = /[\u200b\u200c\u200d]/g;

export function wordsOf(text: string, font: PdfFont, size: number, measure: PdfMeasure): Word[] {
  return text
    .split(/(\s+)/)
    .map((part) => part.replace(ZERO_WIDTH_PATTERN, ''))
    .filter((part) => part.length > 0 && !/^\s+$/.test(part))
    .map((part) => ({
      text: part,
      font,
      width: measure(part, font, size),
      underline: false,
      strikethrough: false,
    }));
}

/** Span text split on hard breaks first, so `\n` behaves like the HTML `<br />`. */
export function hardLineGroups(spans: CompiledSpan[], size: number, measure: PdfMeasure): Word[][] {
  const groups: Word[][] = [[]];
  for (const span of spans) {
    const font = fontFor(span);
    for (const [index, segment] of span.text.split('\n').entries()) {
      if (index > 0) groups.push([]);
      for (const part of segment.split(/(\s+)/)) {
        const clean = part.replace(ZERO_WIDTH_PATTERN, '');
        if (clean.length === 0 || /^\s+$/.test(clean)) continue;
        groups[groups.length - 1].push({
          text: clean,
          font,
          width: measure(clean, font, size),
          underline: span.underline,
          strikethrough: span.strikethrough,
        });
      }
    }
  }
  return groups;
}

export function wrapGroup(
  words: Word[],
  size: number,
  maxWidth: number,
  firstIndent: number,
  restIndent: number,
  measure: PdfMeasure,
): { lines: Word[][]; indents: number[] } {
  if (words.length === 0) return { lines: [[]], indents: [firstIndent] };
  const lines: Word[][] = [];
  const indents: number[] = [];
  let line: Word[] = [];
  let width = firstIndent;
  let indent = firstIndent;
  for (const word of words) {
    // The gap before a word sets in that word's font, so mixed-style lines
    // measure exactly what drawLine advances.
    const space = measure(' ', word.font, size);
    if (line.length > 0 && width + space + word.width > maxWidth) {
      lines.push(line);
      indents.push(indent);
      line = [];
      width = 0;
      indent = restIndent;
    }
    width += (line.length === 0 ? 0 : space) + word.width;
    line.push(word);
  }
  lines.push(line);
  indents.push(indent);
  return { lines, indents };
}

export function choiceText(
  text: string,
  targetSceneName: string | null,
  page: number | null,
  labels: ManuscriptPdfLabels,
): string {
  const lead = `• ${text}`;
  if (page !== null) return `${lead} — ${labels.goToPage} ${page}`;
  if (targetSceneName) return `${lead} — ${targetSceneName}`;
  return lead;
}
