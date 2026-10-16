import type { ManuscriptImage } from '../../images/imageInfo';
import { PAGE_FORMAT_ASPECT, type PageLayout } from '../pageFormat';
import type { CompiledBlock, CompiledManuscript } from './manuscriptCompiler';
import { escapeHtml } from './escapeHtml';

export type PageBlock = Extract<CompiledBlock, { kind: 'page' }>;

/** Turns a picture into what the document points at: a data URI in one HTML file, a path inside an EPUB. */
export type Source = (mediaId: string, image: ManuscriptImage) => string;

/** The aspect a page frame has when the manuscript does not say: the American comic book page. */
export const DEFAULT_PAGE_ASPECT = PAGE_FORMAT_ASPECT['comic-us'];

/** The picture a page block shows, if the manuscript carries it. */
export function pageImageOf(
  block: PageBlock,
  manuscript: Pick<CompiledManuscript, 'images'>,
): ManuscriptImage | null {
  return block.image ? (manuscript.images?.[block.image.mediaId] ?? null) : null;
}

/**
 * CSS for pages, shared by the HTML and EPUB renderers. A picture shown whole is a plain responsive
 * image; one that fills its frame sits in a box of the frame's shape and is cropped, centred, by it.
 */
export const PAGE_CSS = `figure.page { margin: 1.5em 0; padding: 0; page-break-inside: avoid; break-inside: avoid; }
figure.page figcaption { font-weight: bold; font-size: 0.9em; margin: 0 0 0.4em; text-indent: 0; }
figure.page img { display: block; width: 100%; height: auto; }
figure.page .frame { width: 100%; overflow: hidden; }
figure.page .frame img { width: 100%; height: 100%; object-fit: cover; }
figure.page .missing { font-style: italic; text-indent: 0; border: 1px dashed #999; padding: 1em; text-align: center; margin: 0; }`;

/** The cover of a book: its own page, the picture whole in the middle. */
export const COVER_CSS = `figure.cover { margin: 0 0 2em; padding: 0; text-align: center; page-break-after: always; break-after: page; }
figure.cover img { display: block; max-width: 100%; max-height: 92vh; width: auto; height: auto; margin: 0 auto; }`;

/** The cover as markup, or nothing for a manuscript without one. */
export function coverMarkup(
  manuscript: Pick<CompiledManuscript, 'images' | 'cover' | 'title'>,
  src: Source,
): string {
  const image = manuscript.cover ? manuscript.images?.[manuscript.cover] : undefined;
  if (!manuscript.cover || !image) return '';
  return `<figure class="cover"><img src="${escapeHtml(src(manuscript.cover, image))}" alt="${escapeHtml(manuscript.title)}" /></figure>`;
}

/** A planning sheet: the picture beside what is said about it. Stacks on a narrow screen. */
export const SHEET_CSS = `figure.page.sheet { display: flex; gap: 1.2em; align-items: flex-start; }
figure.page.sheet .art { flex: 0 0 var(--art, 38%); min-width: 0; }
figure.page.sheet .script { flex: 1 1 0; min-width: 0; }
figure.page.sheet .script p { text-indent: 0; margin: 0 0 0.4em; }
@media (max-width: 36rem) { figure.page.sheet { flex-direction: column; } figure.page.sheet .art { flex-basis: auto; width: 100%; } }`;

/** Pages in pairs, as a printed comic opens. One page at a time on a narrow screen. */
export const SPREAD_CSS = `.spread { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin: 1.5em 0; page-break-inside: avoid; break-inside: avoid; }
.spread figure.page { margin: 0; }
.spread figure.page figcaption { text-align: center; font-weight: normal; margin: 0.3em 0 0; }
.spread figure.page.wide { grid-column: 1 / -1; }
@media (max-width: 36rem) { .spread { grid-template-columns: 1fr; gap: 1em; } .spread .blank { display: none; } }`;

/** The stylesheet the pages of a manuscript need, by how they are laid out. */
export function pageCssFor(layout: PageLayout | undefined): string {
  if (layout === 'sheet') return `${PAGE_CSS}\n${SHEET_CSS}`;
  if (layout === 'spreads') return `${PAGE_CSS}\n${SPREAD_CSS}`;
  return PAGE_CSS;
}

/** What stands where a page's picture goes: the picture (cropped to its frame when it fills it), or the placeholder. */
function pictureMarkup(
  block: PageBlock,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect'>,
  src: Source,
  frames = 1,
): string {
  const image = pageImageOf(block, manuscript);
  if (!block.image || !image) {
    return `<p class="missing">${escapeHtml(block.placeholder)}</p>`;
  }
  const alt = escapeHtml(block.label);
  const source = escapeHtml(src(block.image.mediaId, image));
  if (block.image.fit === 'cover') {
    const aspect = (manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT) * frames;
    return `<div class="frame" style="aspect-ratio: ${aspect.toFixed(4)}"><img src="${source}" alt="${alt}" /></div>`;
  }
  return `<img src="${source}" alt="${alt}" />`;
}

/**
 * A page as markup: caption, then the picture (or what stands in for it). `src` turns a picture into
 * what the document points at - a data URI in a single HTML file, a path inside an EPUB.
 */
export function pageFigureMarkup(
  block: PageBlock,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect'>,
  src: Source,
): string {
  const caption = `<figcaption>${escapeHtml(block.label)}</figcaption>`;
  return `<figure class="page">${caption}${pictureMarkup(block, manuscript, src)}</figure>`;
}

/** A page as a row of a planning sheet: the picture on one side, its caption and its text on the other. */
export function pageSheetMarkup(
  block: PageBlock,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect'>,
  src: Source,
): string {
  const frames = block.spread ? 2 : 1;
  const aspect = (manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT) * frames;
  // A frame wider than it is tall (a storyboard's, or a spread's) takes more of the row than a portrait page.
  const share = aspect < 1 ? 38 : 55;
  const lines = block.text.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  return `<figure class="page sheet" style="--art: ${share}%"><div class="art">${pictureMarkup(block, manuscript, src, frames)}</div><div class="script"><figcaption>${escapeHtml(block.label)}</figcaption>${lines}</div></figure>`;
}

/** One opening of a book: the page on the left, the one on the right, or one picture across both. */
export type PageOpening = {
  left: PageBlock | null;
  right: PageBlock | null;
  wide: PageBlock | null;
};

/**
 * The pages as a printed comic opens them: the first page alone on the right, then 2 and 3, 4 and 5, and so on,
 * even numbers on the left. A double-page spread takes an opening whole. A page whose partner is not there
 * (the pages in between belong to something else, or it is the last) stands with an empty side.
 */
export function openingsOf(pages: readonly PageBlock[]): PageOpening[] {
  const openings: PageOpening[] = [];
  let open: PageOpening | null = null;
  const close = () => {
    if (open) openings.push(open);
    open = null;
  };
  for (const page of pages) {
    if (page.spread) {
      close();
      openings.push({ left: null, right: null, wide: page });
    } else if (page.number % 2 === 0) {
      close();
      open = { left: page, right: null, wide: null };
    } else if (open && open.left && open.left.number === page.number - 1) {
      open.right = page;
      close();
    } else {
      close();
      openings.push({ left: null, right: page, wide: null });
    }
  }
  close();
  return openings;
}

/** An opening as markup: a row of two pages (an empty side kept, so a lone right-hand page stays on the right). */
export function pageOpeningMarkup(
  opening: PageOpening,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect'>,
  src: Source,
): string {
  const side = (page: PageBlock | null, name: 'left' | 'right') =>
    page
      ? `<figure class="page ${name}">${pictureMarkup(page, manuscript, src)}<figcaption>${escapeHtml(page.label)}</figcaption></figure>`
      : '<div class="blank"></div>';
  if (opening.wide) {
    const page = opening.wide;
    return `<section class="spread"><figure class="page wide">${pictureMarkup(page, manuscript, src, 2)}<figcaption>${escapeHtml(page.label)}</figcaption></figure></section>`;
  }
  return `<section class="spread">${side(opening.left, 'left')}${side(opening.right, 'right')}</section>`;
}

/** Consecutive pages with nothing between them, laid out together. */
export type PageRun = { kind: 'pages'; pages: PageBlock[] };

/**
 * The blocks with each stretch of consecutive pages gathered into one `PageRun`, for the layouts that set pages
 * together (spreads pair them). A flow lays pages out one at a time: its blocks are returned as they were.
 */
export function withPageRuns(
  blocks: readonly CompiledBlock[],
  layout: PageLayout | undefined,
): (CompiledBlock | PageRun)[] {
  if (layout !== 'spreads') return [...blocks];
  const out: (CompiledBlock | PageRun)[] = [];
  for (const block of blocks) {
    if (block.kind !== 'page') {
      out.push(block);
      continue;
    }
    const last = out[out.length - 1];
    if (last && 'pages' in last) last.pages.push(block);
    else out.push({ kind: 'pages', pages: [block] });
  }
  return out;
}

/** A page, or a run of pages, as markup, in the layout the manuscript asks for. */
export function pageBlockMarkup(
  block: PageBlock | PageRun,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect' | 'pageLayout'>,
  src: Source,
): string {
  if ('pages' in block) {
    return openingsOf(block.pages)
      .map((opening) => pageOpeningMarkup(opening, manuscript, src))
      .join('\n');
  }
  if (manuscript.pageLayout === 'sheet') return pageSheetMarkup(block, manuscript, src);
  return pageFigureMarkup(block, manuscript, src);
}

/** The pictures the manuscript's pages use, once each, in the order they first appear. */
export function usedPageImages(
  manuscript: Pick<CompiledManuscript, 'blocks' | 'images'>,
): { mediaId: string; image: ManuscriptImage }[] {
  const seen = new Set<string>();
  const used: { mediaId: string; image: ManuscriptImage }[] = [];
  for (const block of manuscript.blocks) {
    if (block.kind !== 'page' || !block.image || seen.has(block.image.mediaId)) continue;
    const image = manuscript.images?.[block.image.mediaId];
    if (!image) continue;
    seen.add(block.image.mediaId);
    used.push({ mediaId: block.image.mediaId, image });
  }
  return used;
}

export const hasPages = (blocks: readonly CompiledBlock[]): boolean =>
  blocks.some((block) => block.kind === 'page');
