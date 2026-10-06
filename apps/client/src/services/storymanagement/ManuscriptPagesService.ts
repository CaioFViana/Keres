import { type ManuscriptImage, type ManuscriptPage, readImageInfo } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { mediaFileService } from '../MediaFileService';
import { createGalleryService } from './GalleryService';
import { createScenePageService, groupPagesByScene } from './ScenePageService';
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

/**
 * The pages of a story's scenes, ready for a manuscript: each page's picture read from this device (a
 * Sketch through its snapshot, redrawn first if the drawing has changed since), and each page that has
 * none left in place as a page without a picture.
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
        if (info) {
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

  const pagesByScene = new Map<string, ManuscriptPage[]>();
  for (const [sceneId, pages] of groupPagesByScene(rows)) {
    const out: ManuscriptPage[] = [];
    for (const page of pages) {
      let galleryId = page.galleryId;
      if (!galleryId && page.sketchId && !readPictures) {
        // No picture is wanted, so no snapshot is drawn: the Sketch only has to still exist.
        const sketch = await createSketchService(db).getById(page.sketchId);
        if (sketch && !sketch.isDeleted) galleryId = `sketch:${sketch.id}`;
        else problems.missing += 1;
      } else if (!galleryId && page.sketchId) {
        try {
          galleryId = (await ensureSketchSnapshot(db, userId, page.sketchId))?.galleryId ?? null;
          if (!galleryId) problems.missing += 1;
        } catch (error) {
          console.log('loadManuscriptPages: could not draw a sketch snapshot.', error);
          problems.snapshot += 1;
        }
      } else if (!galleryId) {
        problems.missing += 1;
      }
      out.push({
        id: page.id,
        mediaId: galleryId ? (readPictures ? await mediaIdOf(galleryId) : galleryId) : null,
        fit: page.fit,
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
  // A Sketch has no file until its snapshot is drawn: counted as a large PNG, on the safe side.
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
