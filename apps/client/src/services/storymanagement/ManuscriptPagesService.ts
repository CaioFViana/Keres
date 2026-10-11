import {
  MAX_MANUSCRIPT_IMAGE_PIXELS,
  type ManuscriptImage,
  type ManuscriptPage,
  readImageInfo,
} from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { mediaFileService } from '../MediaFileService';
import { createGalleryService } from './GalleryService';
import { createScenePageService, groupPagesByScene } from './ScenePageService';
import {
  createSketchPreviewService,
  SKETCH_PREVIEW_PRINT_LOOK,
} from './SketchPreviewService';
import { createSketchService } from './SketchService';
import { ensureSketchSnapshot } from './SketchSnapshotService';

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
 * Sketch drawn from its content on paper), and each page that has none left in place as a page
 * without a picture. Drawing a Sketch adds no Gallery row: the file lives in the preview cache.
 */
export async function loadManuscriptPages(
  db: AppDrizzleClient,
  userId: string,
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
      console.log('loadManuscriptPages: could not read a page image.', error);
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
        const previews = createSketchPreviewService();
        const made = await previews.ensure(sketch.name, sketch.content, SKETCH_PREVIEW_PRINT_LOOK);
        const bytes = made.bytes ?? (await previews.readBytes(made.uri));
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
      console.log('loadManuscriptPages: could not draw a sketch preview.', error);
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
 * Redraws the Gallery snapshot of every Sketch that a page of the story stands on and whose drawing
 * changed since its snapshot was made, and returns how many were redrawn. This is the one automatic
 * path that still writes to the Gallery, and only on an explicit publish: the server compiles a
 * publication from what it was sent and cannot draw a Sketch itself, so the new snapshots are
 * changes that still have to sync before the publication can show them. Display and local export
 * draw from the preview cache instead and never touch the Gallery.
 */
export async function refreshStaleSketchSnapshots(
  db: AppDrizzleClient,
  userId: string,
  storyId: string,
): Promise<number> {
  const rows = await createScenePageService(db).getPagesForStory(storyId);
  const sketchIds = [...new Set(rows.flatMap((page) => (page.sketchId ? [page.sketchId] : [])))];
  let redrawn = 0;
  for (const sketchId of sketchIds) {
    try {
      if ((await ensureSketchSnapshot(db, userId, sketchId))?.regenerated) redrawn += 1;
    } catch (error) {
      console.log('refreshStaleSketchSnapshots: could not redraw a snapshot.', error);
    }
  }
  return redrawn;
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
    console.log('loadManuscriptCover: could not read the cover.', error);
    return null;
  }
}
