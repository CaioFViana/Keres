import {
  decodeSketchDocument,
  MAX_MANUSCRIPT_IMAGE_PIXELS,
  validateSketchContent,
  type ManuscriptImage,
  type ManuscriptPage,
  readImageInfo,
} from '@keres/shared';
import type { AppDrizzleClient } from '@/src/db';
import { renderSketchSvg } from '@/src/utils/sketch/sketchSvg';
import type { SvgExportColors } from '@/src/utils/svg/svgExport';
import { fitRasterSize, rasterizeMapSvg } from '@/src/state/ui/svgRaster';
import { mediaFileService } from '@/src/services/media/MediaFileService';
import { createGalleryService } from '@/src/services/storymanagement/media-music/GalleryService';
import { createScenePageService, groupPagesByScene } from './ScenePageService';
import { createSketchService } from '@/src/services/storymanagement/media-music/SketchService';
import { logger } from '@/src/utils/logging/logger';

/** A manuscript page is paper whatever theme the app is in. */
const PRINT_COLORS: SvgExportColors = {
  background: '#ffffff',
  surface: '#ffffff',
  text: '#1f1f1f',
  textSecondary: '#5a5a5a',
  border: '#c8c8c8',
  primary: '#3b5bdb',
};

/** What could not be put in the manuscript, counted so the person is told rather than left to find a blank. */
export interface ManuscriptPagesProblems {
  /** A page whose Sketch or medium is gone, or whose file is not on this device. */
  missing: number;
  /** A medium that is not a PNG or a JPEG (a GIF, a WebP): the pipeline embeds only those two. */
  unsupported: number;
  /** A Sketch whose snapshot could not be drawn and has none to fall back on. */
  snapshot: number;
}

export interface ManuscriptPagesLoad {
  pagesByScene: Map<string, ManuscriptPage[]>;
  /** The pictures the pages point at, by the Gallery medium they are. */
  media: Record<string, ManuscriptImage>;
  problems: ManuscriptPagesProblems;
}

/** A Sketch page's key in `media`: its drawing, not a Gallery row. */
const sketchMediaKey = (sketchId: string) => `sketch:${sketchId}`;
const isSketchMediaKey = (mediaId: string) => mediaId.startsWith('sketch:');

/**
 * The pages of a story's scenes, ready for a manuscript: each page's picture read from this device (a
 * Sketch drawn straight from its content on paper), and each page that has none left in place
 * as a page without a picture. Drawing a Sketch writes no file and adds no Gallery row.
 */
export async function loadManuscriptPages(
  db: AppDrizzleClient,
  storyId: string,
  sceneIds?: ReadonlySet<string>,
  /** False for a format with no pictures: nothing is read or drawn, a page only learns whether its picture exists. */
  readPictures = true,
): Promise<ManuscriptPagesLoad> {
  const problems: ManuscriptPagesProblems = { missing: 0, unsupported: 0, snapshot: 0 };
  const rows = (await createScenePageService(db).getPagesForStory(storyId)).filter(
    (page) => !sceneIds || sceneIds.has(page.sceneId),
  );
  const galleryService = createGalleryService(db);
  const media: Record<string, ManuscriptImage> = {};
  const settled = new Map<string, string | null>();

  // A medium is read once however many pages use it; `null` records one that cannot be used.
  const mediaIdOf = async (galleryId: string): Promise<string | null> => {
    if (settled.has(galleryId)) return settled.get(galleryId) ?? null;
    let result: string | null = null;
    try {
      const row = await galleryService.getById(galleryId);
      if (row && !row.isDeleted && !readPictures) {
        result = galleryId;
      } else if (row && !row.isDeleted && row.localPath) {
        const bytes = await mediaFileService.readBytes(row.localPath);
        const info = readImageInfo(bytes);
        if (info && info.width * info.height <= MAX_MANUSCRIPT_IMAGE_PIXELS) {
          media[galleryId] = { ...info, bytes };
          result = galleryId;
        } else {
          problems.unsupported += 1;
        }
      } else {
        problems.missing += 1;
      }
    } catch (error) {
      logger.debug('loadManuscriptPages: could not read a page image.', error);
      problems.missing += 1;
    }
    settled.set(galleryId, result);
    return result;
  };

  // A drawing is rendered once however many pages stand on it.
  const sketched = new Map<string, string | null>();
  const sketchPictureIdOf = async (sketchId: string): Promise<string | null> => {
    if (sketched.has(sketchId)) return sketched.get(sketchId) ?? null;
    let result: string | null = null;
    try {
      const sketch = await createSketchService(db).getById(sketchId);
      if (sketch && !sketch.isDeleted) {
        const doc = decodeSketchDocument(validateSketchContent(sketch.content));
        const svg = renderSketchSvg(doc, {
          title: sketch.name,
          colors: PRINT_COLORS,
          paper: '#ffffff',
        });
        const pixels = fitRasterSize(doc.page.width, doc.page.height);
        const bytes = await rasterizeMapSvg(svg, pixels.width, pixels.height);
        const info = bytes ? readImageInfo(bytes) : null;
        if (bytes && info && info.width * info.height <= MAX_MANUSCRIPT_IMAGE_PIXELS) {
          result = sketchMediaKey(sketch.id);
          media[result] = { ...info, bytes };
        } else if (bytes) {
          problems.unsupported += 1;
        } else {
          problems.snapshot += 1;
        }
      } else {
        problems.missing += 1;
      }
    } catch (error) {
      logger.debug('loadManuscriptPages: could not draw a sketch preview.', error);
      problems.snapshot += 1;
    }
    sketched.set(sketchId, result);
    return result;
  };

  const pagesByScene = new Map<string, ManuscriptPage[]>();
  for (const [sceneId, pages] of groupPagesByScene(rows)) {
    const out: ManuscriptPage[] = [];
    for (const page of pages) {
      let galleryId = page.galleryId;
      if (!galleryId && page.sketchId && !readPictures) {
        // No picture is wanted, so nothing is drawn: the Sketch only has to still exist.
        const sketch = await createSketchService(db).getById(page.sketchId);
        if (sketch && !sketch.isDeleted) galleryId = sketchMediaKey(sketch.id);
        else problems.missing += 1;
      } else if (!galleryId && page.sketchId) {
        galleryId = await sketchPictureIdOf(page.sketchId);
      } else if (!galleryId) {
        problems.missing += 1;
      }
      out.push({
        id: page.id,
        mediaId:
          galleryId && readPictures && !isSketchMediaKey(galleryId)
            ? await mediaIdOf(galleryId)
            : galleryId,
        fit: page.fit,
        ...(page.spread ? { spread: true } : {}),
        text: page.text,
      });
    }
    pagesByScene.set(sceneId, out);
  }
  return { pagesByScene, media, problems };
}

/** Bytes of the pictures the pages would bring, from what is known without reading any file. */
export async function estimateManuscriptPageBytes(
  db: AppDrizzleClient,
  storyId: string,
): Promise<Map<string, number[]>> {
  const galleryService = createGalleryService(db);
  const rows = await createScenePageService(db).getPagesForStory(storyId);
  const sizes = new Map<string, number[]>();
  // A Sketch is drawn at export time, so its bytes are unknown: counted as a large PNG, on the safe side.
  const SKETCH_SNAPSHOT_GUESS = 1_000_000;
  for (const page of rows) {
    let bytes = SKETCH_SNAPSHOT_GUESS;
    if (page.galleryId) {
      const row = await galleryService.getById(page.galleryId).catch(() => undefined);
      bytes = row && !row.isDeleted ? Number(row.sizeBytes ?? 0) : 0;
    } else if (!page.sketchId) {
      bytes = 0;
    }
    const list = sizes.get(page.sceneId) ?? [];
    list.push(bytes);
    sizes.set(page.sceneId, list);
  }
  return sizes;
}

/**
 * The cover of a book, read from this device: the picture it is, or `null` when it has none, it is gone, it is not
 * on this device or it is not an image the manuscript can embed (a GIF, a WebP). Said by returning nothing: a book
 * without its cover is still a book.
 */
export async function loadManuscriptCover(
  db: AppDrizzleClient,
  galleryId: string | null | undefined,
): Promise<{ key: string; image: ManuscriptImage } | null> {
  if (!galleryId) return null;
  try {
    const row = await createGalleryService(db).getById(galleryId);
    if (!row || row.isDeleted || row.mediaType !== 'image' || !row.localPath) return null;
    const bytes = await mediaFileService.readBytes(row.localPath);
    const info = readImageInfo(bytes);
    if (!info || info.width * info.height > MAX_MANUSCRIPT_IMAGE_PIXELS) return null;
    return { key: `cover:${galleryId}`, image: { ...info, bytes } };
  } catch (error) {
    logger.debug('loadManuscriptCover: could not read the cover.', error);
    return null;
  }
}
