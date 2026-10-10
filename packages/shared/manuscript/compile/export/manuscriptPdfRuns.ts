import {
  manuscriptTocEntries,
  sceneHeadingLabel,
  type CompiledManuscript,
  type ManuscriptRenderOptions,
  type ManuscriptTocEntry,
} from './manuscriptCompiler';
import { DEFAULT_PAGE_ASPECT } from './manuscriptPageFigure';
import {
  choiceText,
  hardLineGroups,
  pagePicturePlacement,
  pdfGeometry,
  pdfImageFor,
  widthOfTextAtSize,
  wordsOf,
  wrapGroup,
  type LineRun,
  type ManuscriptPdfLabels,
  type PdfFont,
  type PdfGeometry,
  type PdfMeasure,
  type Word,
} from './manuscriptPdfLayout';

/**
 * The manuscript's line pass and pagination: compiled blocks become positioned line runs one block
 * at a time, and the runs are placed on pages. Measurement, wrapping and picture placement come
 * from `manuscriptPdfLayout.ts`; the serializers (`manuscriptPdf.ts`, `manuscriptPdfDraw.ts`)
 * draw the pages.
 */

const CHOICE_INDENT = 18;
const TOC_INDENT = 18;
const LIST_INDENT = 18;

const INK = 0.07;
const GRAY = 0.27;

/**
 * The manuscript as lines, one at a time. A line is handed over as soon as its block is laid out and
 * nothing here keeps it afterwards, so the layout of a book costs a block, not the book: the caller
 * places each line on a page and lets it go. (Only the index is built whole: it is a line per heading.)
 */
export function* iterateRuns(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  anchors: Map<string, PdfAnchor>,
  options: ManuscriptRenderOptions,
  measure: PdfMeasure = widthOfTextAtSize,
): Generator<LineRun, void, undefined> {
  const geometry = pdfGeometry(options);
  const { contentWidth: CONTENT_WIDTH, bodySize: BODY_SIZE, bodyLeading: BODY_LEADING } = geometry;
  const runs: LineRun[] = [];
  const pushHeading = (
    text: string,
    font: PdfFont,
    size: number,
    leading: number,
    opts: Partial<LineRun> & { spaceAfter: number },
  ) => {
    const { lines, indents } = wrapGroup(
      wordsOf(text, font, size, measure),
      size,
      CONTENT_WIDTH,
      0,
      0,
      measure,
    );
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
      const nameWidth = measure(entry.text, font, BODY_SIZE);
      const numberText = page === null ? '' : String(page);
      const numberWidth = numberText === '' ? 0 : measure(numberText, font, BODY_SIZE);
      const dotWidth = measure('.', font, BODY_SIZE);
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
                  2 * measure(' ', font, BODY_SIZE)) /
                  dotWidth,
              ),
            );
      const text =
        numberText === '' ? entry.text : `${entry.text} ${'.'.repeat(dotCount)} ${numberText}`;
      const { lines, indents } = wrapGroup(
        wordsOf(text, font, BODY_SIZE, measure),
        BODY_SIZE,
        CONTENT_WIDTH,
        indent,
        indent,
        measure,
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

  // Empty headings (an untitled story or route) and paragraphs that degrade to nothing
  // (zero-width-only) would otherwise leave phantom blank lines - at the end, between scenes, or
  // anywhere they land - so they are never handed over. The title page holds the title and the
  // index alone: the first line after the index opens a fresh page, whatever kind of block leads it.
  let opensNewPage = false;
  const drain = function* (): Generator<LineRun, void, undefined> {
    for (const run of runs) {
      if (run.words.length === 0 && !run.image) continue;
      if (opensNewPage) {
        run.forcePageBreak = true;
        opensNewPage = false;
      }
      yield run;
    }
    runs.length = 0;
  };

  let prevBlockKind: string | null = null;
  let tocEmitted = false;
  // Display numbers of one ordered run; any other block restarts the run at 1.
  let orderedCount = 0;
  for (const block of manuscript.blocks) {
    if (block.kind !== 'ordered') orderedCount = 0;
    if (!tocEmitted && block.kind !== 'title' && block.kind !== 'subtitle') {
      tocEmitted = true;
      if (options.includeToc) {
        const before = runs.length;
        pushToc(manuscriptTocEntries(manuscript.blocks));
        const produced = runs.length > before;
        yield* drain();
        opensNewPage = produced;
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
        pushHeading(sceneHeadingLabel(block), 'times-bold', 12.5, 16, {
          spaceBefore: 12,
          spaceAfter: 6,
          gray: GRAY,
          bookmarkId: block.bookmarkId,
          keepWithNext: true,
        });
        break;
      case 'paragraph': {
        const groups = hardLineGroups(block.spans, BODY_SIZE, measure);
        let firstLine = true;
        groups.forEach((group) => {
          const { lines, indents } = wrapGroup(
            group,
            BODY_SIZE,
            CONTENT_WIDTH,
            firstLine ? geometry.firstLineIndent : 0,
            0,
            measure,
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
              spaceAfter: lastOfParagraph ? geometry.paragraphGap : 0,
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
      case 'page': {
        pushHeading(block.label, 'times-bold', 10, 13, {
          spaceBefore: 8,
          spaceAfter: 3,
          gray: GRAY,
          keepWithNext: true,
        });
        const image = block.image ? manuscript.images?.[block.image.mediaId] : undefined;
        // A picture this build cannot draw (an interlaced PNG, a damaged file) is a missing one.
        if (!block.image || !image || !pdfImageFor(manuscript.images ?? {}, block.image.mediaId)) {
          pushHeading(block.placeholder, 'times-italic', BODY_SIZE, BODY_LEADING, {
            spaceAfter: 8,
            gray: GRAY,
            keepWithNext: false,
          });
          break;
        }
        const picture = pagePicturePlacement(
          image,
          block.image.fit,
          manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT,
          geometry,
          block.image.mediaId,
        );
        runs.push({
          words: [],
          size: 0,
          leading: picture.frameHeight,
          indent: 0,
          spaceBefore: 0,
          spaceAfter: 8,
          centered: false,
          gray: INK,
          bookmarkId: null,
          linkTarget: null,
          keepWithNext: false,
          forcePageBreak: false,
          image: picture,
        });
        break;
      }
      case 'scene-break':
        pushHeading(block.text, 'times', BODY_SIZE, BODY_LEADING, {
          spaceBefore: 4,
          spaceAfter: 11,
          centered: true,
          keepWithNext: true,
        });
        break;
      case 'bullet':
      case 'ordered': {
        if (block.kind === 'ordered') orderedCount += 1;
        const marker = block.kind === 'bullet' ? '•' : `${orderedCount}.`;
        const markerWord: Word = {
          text: marker,
          font: 'times',
          width: measure(marker, 'times', BODY_SIZE),
          underline: false,
          strikethrough: false,
        };
        const groups = hardLineGroups(block.spans, BODY_SIZE, measure);
        groups.forEach((group, groupIndex) => {
          const words = groupIndex === 0 ? [markerWord, ...group] : group;
          const { lines, indents } = wrapGroup(
            words,
            BODY_SIZE,
            CONTENT_WIDTH,
            LIST_INDENT,
            LIST_INDENT,
            measure,
          );
          lines.forEach((lineWords, index) => {
            const lastOfItem =
              groups.indexOf(group) === groups.length - 1 && index === lines.length - 1;
            runs.push({
              words: lineWords,
              size: BODY_SIZE,
              leading: BODY_LEADING,
              indent: indents[index],
              spaceBefore: 0,
              spaceAfter: lastOfItem ? geometry.paragraphGap : 0,
              centered: false,
              gray: INK,
              bookmarkId: null,
              linkTarget: null,
              keepWithNext: false,
              forcePageBreak: false,
            });
          });
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
            wordsOf(text, 'times', BODY_SIZE, measure),
            BODY_SIZE,
            CONTENT_WIDTH,
            indent,
            indent,
            measure,
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
    yield* drain();
  }
}

/** Every line of the manuscript at once - for callers (and tests) that want the whole list. */
export function flattenRuns(
  manuscript: CompiledManuscript,
  labels: ManuscriptPdfLabels,
  anchors: Map<string, PdfAnchor>,
  options: ManuscriptRenderOptions,
  measure: PdfMeasure = widthOfTextAtSize,
): LineRun[] {
  return Array.from(iterateRuns(manuscript, labels, anchors, options, measure));
}

export type PlacedRun = { run: LineRun; y: number };

/** Where a heading landed: page numbers resolve choices, coordinates aim index links. */
export type PdfAnchor = { page: number; y: number };

/**
 * Places lines on pages and hands each page over as soon as it is full, so only the page in
 * progress (and one line of lookahead: a heading keeps with the line after it) is held. Returns
 * where every heading landed and how many pages there are.
 */
export function paginateStream(
  runs: Iterable<LineRun>,
  geometry: PdfGeometry,
  onPage: (page: PlacedRun[], pageIndex: number) => void,
): { anchors: Map<string, PdfAnchor>; pageCount: number } {
  const { topY: TOP_Y, bottomY: BOTTOM_Y } = geometry;
  const anchors = new Map<string, PdfAnchor>();
  const iterator = runs[Symbol.iterator]();
  let page: PlacedRun[] = [];
  let pageCount = 1;
  let y = TOP_Y;
  let current = iterator.next();
  while (!current.done) {
    const run = current.value;
    const upcoming = iterator.next();
    const next = upcoming.done ? undefined : upcoming.value;
    const keepHeight = run.keepWithNext && next ? next.spaceBefore + next.leading : 0;
    const need = run.spaceBefore + run.leading + keepHeight;
    if ((run.forcePageBreak && page.length > 0) || y - need < BOTTOM_Y) {
      onPage(page, pageCount - 1);
      page = [];
      pageCount += 1;
      y = TOP_Y;
    }
    y -= run.spaceBefore;
    if (run.bookmarkId && !anchors.has(run.bookmarkId)) {
      anchors.set(run.bookmarkId, { page: pageCount, y });
    }
    page.push({ run, y });
    y -= run.leading + run.spaceAfter;
    current = upcoming;
  }
  onPage(page, pageCount - 1);
  return { anchors, pageCount };
}

export function paginate(
  runs: LineRun[],
  geometry: PdfGeometry = pdfGeometry(),
): {
  pages: PlacedRun[][];
  anchors: Map<string, PdfAnchor>;
} {
  const pages: PlacedRun[][] = [];
  const { anchors } = paginateStream(runs, geometry, (page) => pages.push(page));
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
