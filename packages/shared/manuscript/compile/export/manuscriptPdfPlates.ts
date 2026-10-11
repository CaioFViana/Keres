import type { CompiledManuscript, ManuscriptRenderOptions } from './manuscriptCompiler';
import { DEFAULT_PAGE_ASPECT, type PageBlock, type PageOpening } from './manuscriptPageFigure';
import {
  pagePicturePlacement,
  pdfImageFor,
  wordsOf,
  wrapGroup,
  type LineRun,
  type PdfGeometry,
  type PdfMeasure,
  type PdfPlateLine,
  type PdfPlatePicture,
  type Word,
} from './manuscriptPdfLayout';

/**
 * A comic's pages as plates: a planning sheet (the picture beside its text) and an opening of two
 * pages. Each plate is one run the paginator only has to know the height of; the pictures and the
 * lines inside it are placed here, relative to the plate.
 */

const SIZE = 10;
const LEADING = 13;
/** Space between the picture and its text on a sheet. */
const GAP = 14;
/** Space between the two pages of an opening: the spine. */
const SPINE = 6;
const INK = 0.07;
const GRAY = 0.27;

/** What a plate adds to the pictures and the lines it was given: the run the paginator places. */
function plateRun(
  pictures: PdfPlatePicture[],
  lines: PdfPlateLine[],
  height: number,
  extra: Partial<LineRun> = {},
): LineRun {
  return {
    words: [],
    size: 0,
    leading: height,
    indent: 0,
    spaceBefore: 6,
    spaceAfter: 12,
    centered: false,
    gray: INK,
    bookmarkId: null,
    linkTarget: null,
    keepWithNext: false,
    forcePageBreak: false,
    plate: { pictures, lines },
    ...extra,
  };
}

const widthOfWords = (words: Word[], measure: PdfMeasure): number =>
  words.reduce(
    (sum, word, index) => sum + word.width + (index > 0 ? measure(' ', word.font, SIZE) : 0),
    0,
  );

/** The picture of a page as a plate picture, or `null` when this build cannot draw it (a damaged file, say). */
function drawable(block: PageBlock, manuscript: CompiledManuscript): boolean {
  const image = block.image ? manuscript.images?.[block.image.mediaId] : undefined;
  return !!block.image && !!image && !!pdfImageFor(manuscript.images ?? {}, block.image.mediaId);
}

/**
 * A page as a row of a planning sheet: its picture at the left, its caption and text at the right. A text taller
 * than a sheet carries on in text-only plates, so nothing written about a page is lost.
 */
export function sheetPlateRuns(
  block: PageBlock,
  manuscript: CompiledManuscript,
  geometry: PdfGeometry,
  measure: PdfMeasure,
): LineRun[] {
  // A double-page spread is two pages wide: its frame is wider than it is tall, and it takes more of the row.
  const aspect = (manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT) * (block.spread ? 2 : 1);
  const share = aspect < 1 ? 0.38 : 0.5;
  const room = geometry.topY - geometry.bottomY - 24;
  const artWidth = geometry.contentWidth * share;
  const pictures: PdfPlatePicture[] = [];
  const lines: PdfPlateLine[] = [];
  let pictureWidth = artWidth;
  let pictureHeight = 0;
  if (block.image && drawable(block, manuscript)) {
    const image = manuscript.images![block.image.mediaId];
    const placed = pagePicturePlacement(
      image,
      block.image.fit,
      aspect,
      { contentWidth: artWidth, topY: geometry.topY, bottomY: geometry.bottomY },
      block.image.mediaId,
    );
    pictures.push({ ...placed, x: 0, top: 0 });
    pictureWidth = placed.frameWidth;
    pictureHeight = placed.frameHeight;
  } else {
    // The picture is not there: its place says so, in the space the picture would have had.
    const { lines: said } = wrapGroup(
      wordsOf(block.placeholder, 'times-italic', SIZE, measure),
      SIZE,
      artWidth,
      0,
      0,
      measure,
    );
    said.forEach((words, index) =>
      lines.push({ words, size: SIZE, x: 0, top: index * LEADING, gray: GRAY }),
    );
    pictureHeight = said.length * LEADING;
  }
  const textX = pictureWidth + GAP;
  const textWidth = Math.max(60, geometry.contentWidth - textX);

  // The caption, then each line of the text; a blank of 3 points marks where a line of the script ends.
  const rows: { words: Word[]; gray: number; gapAfter: number }[] = [];
  const caption = wrapGroup(
    wordsOf(block.label, 'times-bold', SIZE, measure),
    SIZE,
    textWidth,
    0,
    0,
    measure,
  );
  caption.lines.forEach((words, index) =>
    rows.push({ words, gray: GRAY, gapAfter: index === caption.lines.length - 1 ? 4 : 0 }),
  );
  for (const text of block.text) {
    const wrapped = wrapGroup(
      wordsOf(text, 'times', SIZE, measure),
      SIZE,
      textWidth,
      0,
      0,
      measure,
    );
    wrapped.lines.forEach((words, index) =>
      rows.push({ words, gray: INK, gapAfter: index === wrapped.lines.length - 1 ? 3 : 0 }),
    );
  }

  const chunks: { lines: PdfPlateLine[]; height: number }[] = [{ lines: [], height: 0 }];
  let top = 0;
  for (const row of rows) {
    let chunk = chunks[chunks.length - 1];
    if (top + LEADING > room && chunk.lines.length > 0) {
      chunk = { lines: [], height: 0 };
      chunks.push(chunk);
      top = 0;
    }
    chunk.lines.push({ words: row.words, size: SIZE, x: textX, top, gray: row.gray });
    top += LEADING + row.gapAfter;
    chunk.height = top;
  }

  return chunks.map((chunk, index) =>
    plateRun(
      index === 0 ? pictures : [],
      index === 0 ? [...lines, ...chunk.lines] : chunk.lines.map((line) => ({ ...line, x: textX })),
      Math.max(chunk.height, index === 0 ? pictureHeight : 0),
    ),
  );
}

/**
 * An opening of the book on a sheet of its own: the left page and the right one meeting at the spine, each with
 * its caption under it, or one picture across both. Pictures only: the script stays on the planning sheet.
 */
export function openingPlateRun(
  opening: PageOpening,
  manuscript: CompiledManuscript,
  geometry: PdfGeometry,
  measure: PdfMeasure,
): LineRun {
  const aspect = manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT;
  const half = (geometry.contentWidth - SPINE) / 2;
  const captionHeight = LEADING + 6;
  const pictures: PdfPlatePicture[] = [];
  const lines: PdfPlateLine[] = [];
  let height = 0;

  const place = (
    page: PageBlock,
    available: number,
    frames: 1 | 2,
    frameLeft: (frameWidth: number) => number,
  ) => {
    const frameAspect = aspect * frames;
    // The same room for the picture a page of its own would have, less the caption under it.
    const geometryHere = {
      contentWidth: available,
      topY: geometry.topY - captionHeight,
      bottomY: geometry.bottomY,
    };
    let frameWidth = available;
    let frameHeight = frameWidth / frameAspect;
    const roomHeight = geometryHere.topY - geometryHere.bottomY - 48;
    if (frameHeight > roomHeight) {
      frameHeight = roomHeight;
      frameWidth = frameHeight * frameAspect;
    }
    const x = frameLeft(frameWidth);
    if (page.image && drawable(page, manuscript)) {
      const placed = pagePicturePlacement(
        manuscript.images![page.image.mediaId],
        page.image.fit,
        frameAspect,
        geometryHere,
        page.image.mediaId,
      );
      pictures.push({ ...placed, x, top: 0 });
      frameWidth = placed.frameWidth;
      frameHeight = placed.frameHeight;
    } else {
      lines.push({
        words: wordsOf(page.placeholder, 'times-italic', SIZE, measure),
        size: SIZE,
        x,
        top: frameHeight / 2,
        gray: GRAY,
      });
    }
    const label = wordsOf(page.label, 'times', SIZE, measure);
    lines.push({
      words: label,
      size: SIZE,
      x: x + (frameWidth - widthOfWords(label, measure)) / 2,
      top: frameHeight + 6,
      gray: GRAY,
    });
    height = Math.max(height, frameHeight + captionHeight);
  };

  if (opening.wide) {
    place(
      opening.wide,
      geometry.contentWidth,
      2,
      (frameWidth) => (geometry.contentWidth - frameWidth) / 2,
    );
  } else {
    // Left page against the spine from the left, right page against it from the right.
    if (opening.left) place(opening.left, half, 1, (frameWidth) => half - frameWidth);
    if (opening.right) place(opening.right, half, 1, () => half + SPINE);
  }
  return plateRun(pictures, lines, height, { spaceBefore: 0, spaceAfter: 0, forcePageBreak: true });
}

/** Whether the pdf should be set on landscape sheets: the manuscript lays its pages out in spreads. */
export function setsSpreads(
  manuscript: Pick<CompiledManuscript, 'pageLayout'>,
  options: ManuscriptRenderOptions,
): boolean {
  return (options.pageLayout ?? manuscript.pageLayout) === 'spreads';
}
