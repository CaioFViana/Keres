import type { ManuscriptImage } from '../../images/imageInfo';
import { PAGE_FORMAT_ASPECT } from '../pageFormat';
import type { CompiledBlock, CompiledManuscript } from './manuscriptCompiler';
import { escapeHtml } from './manuscriptHtml';

export type PageBlock = Extract<CompiledBlock, { kind: 'page' }>;

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

/**
 * A page as markup: caption, then the picture (or what stands in for it). `src` turns a picture into
 * what the document points at - a data URI in a single HTML file, a path inside an EPUB.
 */
export function pageFigureMarkup(
  block: PageBlock,
  manuscript: Pick<CompiledManuscript, 'images' | 'pageAspect'>,
  src: (mediaId: string, image: ManuscriptImage) => string,
): string {
  const caption = `<figcaption>${escapeHtml(block.label)}</figcaption>`;
  const image = pageImageOf(block, manuscript);
  if (!block.image || !image) {
    return `<figure class="page">${caption}<p class="missing">${escapeHtml(block.placeholder)}</p></figure>`;
  }
  const alt = escapeHtml(block.label);
  const source = escapeHtml(src(block.image.mediaId, image));
  if (block.image.fit === 'cover') {
    const aspect = manuscript.pageAspect ?? DEFAULT_PAGE_ASPECT;
    return `<figure class="page">${caption}<div class="frame" style="aspect-ratio: ${aspect.toFixed(4)}"><img src="${source}" alt="${alt}" /></div></figure>`;
  }
  return `<figure class="page">${caption}<img src="${source}" alt="${alt}" /></figure>`;
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
