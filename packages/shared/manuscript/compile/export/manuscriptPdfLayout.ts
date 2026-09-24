import {
  manuscriptTocEntries,
  type CompiledManuscript,
  type CompiledSpan,
  type ManuscriptRenderOptions,
  type ManuscriptTocEntry,
} from './manuscriptCompiler';
import { TIMES_WIDTHS, type TimesFontKey } from './timesWidths';

/**
 * Measurement, line layout and pagination behind the manuscript PDF: compiled
 * blocks in, positioned line runs out. Serialization (the `PdfWriter`, line
 * drawing, the cross-reference table) stays in `manuscriptPdf.ts`, which is the
 * only importer - the dependency runs one way, serializer above layout.
 */

export type ManuscriptPdfLabels = {
  /** Prefix of a choice reference, e.g. "Go to page" - the number is real, from layout. */
  goToPage: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/**
 * A4 in points, with the print stylesheet's 2cm margins. Both stages share the
 * one geometry: layout wraps and paginates against it, the serializer draws
 * and links against it.
 */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 56.7;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TOP_Y = PAGE_HEIGHT - MARGIN;
const BOTTOM_Y = MARGIN;
export const FOOTER_Y = MARGIN - 24;

const BODY_SIZE = 11;
const BODY_LEADING = 16.5;
const FIRST_LINE_INDENT = 22;
const CHOICE_INDENT = 18;
const TOC_INDENT = 18;

/**
 * The manuscript is set in Times, one of PDF's fourteen standard fonts: no
 * embedding, no dependency, and the same serif face as the HTML export. The
 * standard fonts carry no metrics, so glyph widths come from the static
 * `TIMES_WIDTHS` table (Adobe AFM data) and layout sums them per character.
 */
export type PdfFont = TimesFontKey;

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
};

/**
 * Zero-width joiners are not `\s`, so the word splitter would keep them and
 * WinAnsi would print them as `?`. Stripped before layout, they cost no width.
 */
const ZERO_WIDTH_PATTERN = /[\u200b\u200c\u200d]/g;

function wordsOf(text: string, font: PdfFont, size: number): Word[] {
  return text
    .split(/(\s+)/)
    .map((part) => part.replace(ZERO_WIDTH_PATTERN, ''))
    .filter((part) => part.length > 0 && !/^\s+$/.test(part))
    .map((part) => ({
      text: part,
      font,
      width: widthOfTextAtSize(part, font, size),
      underline: false,
      strikethrough: false,
    }));
}

/** Span text split on hard breaks first, so `\n` behaves like the HTML `<br />`. */
function hardLineGroups(spans: CompiledSpan[], size: number): Word[][] {
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
          width: widthOfTextAtSize(clean, font, size),
          underline: span.underline,
          strikethrough: span.strikethrough,
        });
      }
    }
  }
  return groups;
}

function wrapGroup(
  words: Word[],
  size: number,
  maxWidth: number,
  firstIndent: number,
  restIndent: number,
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
    const space = widthOfTextAtSize(' ', word.font, size);
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

function choiceText(
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

const INK = 0.07;
const GRAY = 0.27;

export function flattenRuns(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  anchors: Map<string, PdfAnchor>,
  options: ManuscriptRenderOptions,
): LineRun[] {
  const runs: LineRun[] = [];
  const pushHeading = (
    text: string,
    font: PdfFont,
    size: number,
    leading: number,
    opts: Partial<LineRun> & { spaceAfter: number },
  ) => {
    const { lines, indents } = wrapGroup(wordsOf(text, font, size), size, CONTENT_WIDTH, 0, 0);
    lines.forEach((words, index) => {
      runs.push({
        words,
        size,
        leading,
        indent: indents[index],
        spaceBefore: index === 0 ? (opts.spaceBefore ?? 0) : 0,
        spaceAfter: index === lines.length - 1 ? opts.spaceAfter : 0,
        centered: opts.centered ?? false,
        gray: opts.gray ?? INK,
        bookmarkId: index === 0 ? (opts.bookmarkId ?? null) : null,
        linkTarget: null,
        keepWithNext: index === lines.length - 1 ? (opts.keepWithNext ?? true) : true,
        forcePageBreak: index === 0 ? (opts.forcePageBreak ?? false) : false,
      });
    });
  };

  const pushToc = (entries: ManuscriptTocEntry[]) => {
    if (entries.length === 0) return;
    pushHeading(labels.tocHeading, 'times-bold', 15, 19, { spaceAfter: 8, keepWithNext: true });
    for (const entry of entries) {
      const font: PdfFont = entry.level === 0 ? 'times-bold' : 'times';
      const indent = entry.level === 0 ? 0 : TOC_INDENT;
      const page = anchors.get(entry.bookmarkId)?.page ?? null;
      const nameWidth = widthOfTextAtSize(entry.text, font, BODY_SIZE);
      const numberText = page === null ? '' : String(page);
      const numberWidth = numberText === '' ? 0 : widthOfTextAtSize(numberText, font, BODY_SIZE);
      const dotWidth = widthOfTextAtSize('.', font, BODY_SIZE);
      const dotCount =
        numberText === ''
          ? 0
          : Math.max(
              0,
              Math.floor(
                (CONTENT_WIDTH -
                  indent -
                  nameWidth -
                  numberWidth -
                  2 * widthOfTextAtSize(' ', font, BODY_SIZE)) /
                  dotWidth,
              ),
            );
      const text =
        numberText === '' ? entry.text : `${entry.text} ${'.'.repeat(dotCount)} ${numberText}`;
      const { lines, indents } = wrapGroup(
        wordsOf(text, font, BODY_SIZE),
        BODY_SIZE,
        CONTENT_WIDTH,
        indent,
        indent,
      );
      lines.forEach((words, index) => {
        runs.push({
          words,
          size: BODY_SIZE,
          leading: BODY_LEADING,
          indent: indents[index],
          spaceBefore: 0,
          spaceAfter: index === lines.length - 1 ? 2 : 0,
          centered: false,
          gray: INK,
          bookmarkId: null,
          linkTarget: index === 0 ? entry.bookmarkId : null,
          keepWithNext: false,
          forcePageBreak: false,
        });
      });
    }
    const last = runs[runs.length - 1];
    if (last) last.spaceAfter = 10;
  };

  let prevBlockKind: string | null = null;
  let tocEmitted = false;
  let tocEndIndex: number | null = null;
  for (const block of manuscript.blocks) {
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) {
        const before = runs.length;
        pushToc(manuscriptTocEntries(manuscript.blocks));
        if (runs.length > before) tocEndIndex = runs.length;
      }
    }
    switch (block.kind) {
      case 'title':
        pushHeading(block.text, 'times-bold', 24, 29, {
          spaceAfter: 12,
          centered: true,
          keepWithNext: true,
        });
        break;
      case 'subtitle':
        pushHeading(block.text, 'times-italic', 13, 17, {
          spaceAfter: 24,
          centered: true,
          gray: GRAY,
          keepWithNext: true,
        });
        break;
      case 'chapter':
        // Mirrors the print stylesheet: chapters open a new page, except the
        // one that follows the title block straight away.
        pushHeading(
          block.number === null ? block.name : `${block.number}. ${block.name}`,
          'times-bold',
          17,
          21,
          {
            spaceAfter: 10,
            keepWithNext: true,
            bookmarkId: block.bookmarkId,
            forcePageBreak: prevBlockKind !== 'title' && prevBlockKind !== 'subtitle',
          },
        );
        break;
      case 'loose-heading':
        pushHeading(block.label, 'times-bold', 15, 19, {
          spaceAfter: 8,
          keepWithNext: true,
          bookmarkId: block.bookmarkId,
          forcePageBreak: prevBlockKind !== 'title' && prevBlockKind !== 'subtitle',
        });
        break;
      case 'scene-heading':
        pushHeading(`${block.number}. ${block.name}`, 'times-bold', 12.5, 16, {
          spaceBefore: 12,
          spaceAfter: 6,
          gray: GRAY,
          bookmarkId: block.bookmarkId,
          keepWithNext: true,
        });
        break;
      case 'paragraph': {
        const groups = hardLineGroups(block.spans, BODY_SIZE);
        let firstLine = true;
        groups.forEach((group) => {
          const { lines, indents } = wrapGroup(
            group,
            BODY_SIZE,
            CONTENT_WIDTH,
            firstLine ? FIRST_LINE_INDENT : 0,
            0,
          );
          lines.forEach((words, index) => {
            const lastOfParagraph =
              groups.indexOf(group) === groups.length - 1 && index === lines.length - 1;
            runs.push({
              words,
              size: BODY_SIZE,
              leading: BODY_LEADING,
              indent: indents[index],
              spaceBefore: 0,
              spaceAfter: lastOfParagraph ? 7 : 0,
              centered: false,
              gray: INK,
              bookmarkId: null,
              linkTarget: null,
              keepWithNext: false,
              forcePageBreak: false,
            });
          });
          firstLine = false;
        });
        break;
      }
      case 'choice': {
        const page = block.targetBookmarkId
          ? (anchors.get(block.targetBookmarkId)?.page ?? null)
          : null;
        const annotations = [...(block.requirements ?? []), ...(block.effects ?? [])];
        const pushWrapped = (text: string, indent: number, trailing: number) => {
          const { lines, indents } = wrapGroup(
            wordsOf(text, 'times', BODY_SIZE),
            BODY_SIZE,
            CONTENT_WIDTH,
            indent,
            indent,
          );
          lines.forEach((words, index) => {
            runs.push({
              words,
              size: BODY_SIZE,
              leading: BODY_LEADING,
              indent: indents[index],
              spaceBefore: 0,
              spaceAfter: index === lines.length - 1 ? trailing : 0,
              centered: false,
              gray: INK,
              bookmarkId: null,
              linkTarget: null,
              keepWithNext: false,
              forcePageBreak: false,
            });
          });
        };
        pushWrapped(
          choiceText(block.text, block.targetSceneName, page, labels),
          CHOICE_INDENT,
          annotations.length > 0 ? 0 : 7,
        );
        annotations.forEach((line, lineIndex) => {
          pushWrapped(line, CHOICE_INDENT * 2, lineIndex === annotations.length - 1 ? 7 : 0);
        });
        break;
      }
    }
    prevBlockKind = block.kind;
  }
  if (tocEndIndex !== null) {
    // The title page holds the title and the index alone: the body always
    // opens on a fresh page, whatever kind of block leads it.
    const first = runs.findIndex((run, index) => index >= tocEndIndex && run.words.length > 0);
    if (first !== -1) runs[first].forcePageBreak = true;
  }
  // Trim: empty headings (an untitled story or route) and paragraphs that
  // degrade to nothing (zero-width-only) would otherwise leave phantom blank
  // lines — at the end, between scenes, or anywhere they land.
  return runs.filter((run) => run.words.length > 0);
}

export type PlacedRun = { run: LineRun; y: number };

/** Where a heading landed: page numbers resolve choices, coordinates aim index links. */
export type PdfAnchor = { page: number; y: number };

export function paginate(runs: LineRun[]): {
  pages: PlacedRun[][];
  anchors: Map<string, PdfAnchor>;
} {
  const pages: PlacedRun[][] = [[]];
  const anchors = new Map<string, PdfAnchor>();
  let y = TOP_Y;
  runs.forEach((run, index) => {
    const next = runs[index + 1];
    const keepHeight = run.keepWithNext && next ? next.spaceBefore + next.leading : 0;
    const need = run.spaceBefore + run.leading + keepHeight;
    if ((run.forcePageBreak && pages[pages.length - 1].length > 0) || y - need < BOTTOM_Y) {
      pages.push([]);
      y = TOP_Y;
    }
    y -= run.spaceBefore;
    if (run.bookmarkId && !anchors.has(run.bookmarkId)) {
      anchors.set(run.bookmarkId, { page: pages.length, y });
    }
    pages[pages.length - 1].push({ run, y });
    y -= run.leading + run.spaceAfter;
  });
  return { pages, anchors };
}

export function sameAnchorPages(
  left: Map<string, PdfAnchor>,
  right: Map<string, PdfAnchor>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key)?.page !== value.page) return false;
  }
  return true;
}
