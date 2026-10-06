import {
  compareRanked,
  estimateManuscriptBytes,
  isSketchSnapshotFresh,
  MAX_MANUSCRIPT_BYTES,
  MAX_MANUSCRIPT_IMAGE_PIXELS,
  readImageInfo,
  sceneMatchesArc,
  utf8ByteLength,
  type CompileStoryReaderInput,
  type FullStoryExportType,
  type ManuscriptImage,
  type ManuscriptPage,
} from '@keres/shared';

/** What compiling a publication needs from storage: the bytes behind a Gallery row's hash. */
export type ReadMediaBytes = (hash: string) => Promise<Uint8Array | null>;

/** Formats that can show a picture; the rest keep a page's caption and text. */
const PICTURE_FORMATS = new Set(['docx', 'pdf', 'epub', 'html', 'reader']);

export const carriesPictures = (format: string): boolean => PICTURE_FORMATS.has(format);

/**
 * Gives the compile input the pages of its scenes and, for a format that shows them, their pictures. A
 * page shows its Gallery image, or the snapshot its Sketch keeps in the Gallery (the app draws a fresh
 * one before publishing: the server only reads what it was sent, and a Sketch that changed since stays
 * as its last snapshot). A page whose picture is gone, is not an image the pipeline embeds, or cannot be
 * read keeps its text and says so where the picture would be.
 *
 * The size is judged before any picture is read, from the sizes the Gallery already records, so a book
 * that cannot fit is refused without loading it - in the words every compiler uses for it.
 */
export async function withScenePages(
  input: CompileStoryReaderInput,
  storyExport: FullStoryExportType,
  options: { format: string; arcId?: string; includePictures?: boolean },
  readMedia: ReadMediaBytes,
): Promise<CompileStoryReaderInput> {
  const livePages = (storyExport.scenePages ?? []).filter((page) => !page.isDeleted);
  if (livePages.length === 0) return input;

  const chaptersById = new Map(input.chapters.map((chapter) => [chapter.id, chapter]));
  const sceneIds = new Set(
    input.scenes
      .filter((scene) => !scene.isDeleted && sceneMatchesArc(scene, chaptersById, options.arcId))
      .map((scene) => scene.id),
  );
  const galleries = new Map(
    storyExport.galleryItems.filter((row) => !row.isDeleted).map((row) => [row.id, row]),
  );
  const sketches = new Map(
    (storyExport.storySketches ?? []).filter((row) => !row.isDeleted).map((row) => [row.id, row]),
  );

  // The Gallery image a page stands on: its own, or its Sketch's snapshot.
  const galleryIdOf = (page: (typeof livePages)[number]): string | null => {
    const id =
      page.galleryId ?? (page.sketchId ? sketches.get(page.sketchId)?.coverGalleryId : null);
    const row = id ? galleries.get(id) : undefined;
    return row && row.mediaType === 'image' ? row.id : null;
  };

  const used = new Set<string>();
  const byScene = new Map<string, typeof livePages>();
  for (const page of livePages) {
    if (!sceneIds.has(page.sceneId)) continue;
    const list = byScene.get(page.sceneId) ?? [];
    list.push(page);
    byScene.set(page.sceneId, list);
    const id = galleryIdOf(page);
    if (id) used.add(id);
  }
  if (byScene.size === 0) return input;

  const readPictures = options.includePictures ?? carriesPictures(options.format);
  if (readPictures) {
    const textBytes = input.scenes.reduce(
      (sum, scene) => (sceneIds.has(scene.id) ? sum + utf8ByteLength(scene.body ?? '') : sum),
      0,
    );
    const estimate = estimateManuscriptBytes({
      format: options.format as never,
      textBytes,
      imageBytes: [...used].map((id) => Number(galleries.get(id)?.sizeBytes ?? 0)),
    });
    if (estimate > MAX_MANUSCRIPT_BYTES) {
      throw new Error(
        `Manuscript exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit (estimated ${estimate} bytes with the page pictures).`,
      );
    }
  }

  const media: Record<string, ManuscriptImage> = {};
  const usable = new Set<string>();
  for (const id of used) {
    if (!readPictures) {
      usable.add(id);
      continue;
    }
    const row = galleries.get(id)!;
    const bytes = await readMedia(row.hash).catch(() => null);
    const info = bytes ? readImageInfo(bytes) : null;
    if (bytes && info && info.width * info.height <= MAX_MANUSCRIPT_IMAGE_PIXELS) {
      media[id] = { ...info, bytes };
      usable.add(id);
    }
  }

  const pagesOf = (sceneId: string): ManuscriptPage[] | undefined => {
    const pages = byScene.get(sceneId);
    if (!pages) return undefined;
    return [...pages].sort(compareRanked).map((page) => {
      const id = galleryIdOf(page);
      return {
        id: page.id,
        mediaId: id && usable.has(id) ? id : null,
        fit: page.fit,
        text: page.text,
      };
    });
  };

  return {
    ...input,
    scenes: input.scenes.map((scene) => {
      const pages = pagesOf(scene.id);
      return pages ? { ...scene, pages } : scene;
    }),
    ...(readPictures ? { media } : {}),
  };
}

/** Whether any live sketch page in scope rests on a snapshot that no longer shows its drawing. */
export function staleSketchPages(storyExport: FullStoryExportType): number {
  const sketches = new Map(
    (storyExport.storySketches ?? []).filter((row) => !row.isDeleted).map((row) => [row.id, row]),
  );
  return (storyExport.scenePages ?? []).filter((page) => {
    if (page.isDeleted || !page.sketchId) return false;
    const sketch = sketches.get(page.sketchId);
    return !!sketch && !isSketchSnapshotFresh(sketch);
  }).length;
}
