import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ScenePageSelect } from '@/src/db/schema';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createScenePageService } from '@/src/services/storymanagement/ScenePageService';
import { createSketchService } from '@/src/services/storymanagement/SketchService';
import { entityEventEmitter } from '@/src/utils/EventEmitter';

/** A page with what it shows: the Gallery medium to draw, its name, and whether the image is gone. */
export interface ScenePageView {
  page: ScenePageSelect;
  /** The Gallery medium to draw: the page's own, or the cover of its Sketch (`null` if it has none). */
  thumbGalleryId: string | null;
  mediaName: string | null;
  isSketch: boolean;
  /** The Sketch or medium it pointed at is gone (or never resolved): the page keeps only its text. */
  mediaGone: boolean;
}

export async function scenePageViewOf(
  db: ReturnType<typeof useDrizzle>,
  page: ScenePageSelect,
): Promise<ScenePageView> {
  if (page.galleryId) {
    const row = await createGalleryService(db).getById(page.galleryId);
    const alive = !!row && !row.isDeleted;
    return {
      page,
      thumbGalleryId: alive ? page.galleryId : null,
      mediaName: alive ? (row.title ?? row.fileName) : null,
      isSketch: false,
      mediaGone: !alive,
    };
  }
  if (page.sketchId) {
    const sketch = await createSketchService(db).getById(page.sketchId);
    const alive = !!sketch && !sketch.isDeleted;
    return {
      page,
      thumbGalleryId: alive ? sketch.coverGalleryId : null,
      mediaName: alive ? sketch.name : null,
      isSketch: true,
      mediaGone: !alive,
    };
  }
  return { page, thumbGalleryId: null, mediaName: null, isSketch: false, mediaGone: true };
}

/**
 * A scene's pages, in order, each with what it shows. Reloads when pages, Sketches or the Gallery
 * change, so a page whose image was deleted on another device turns into "media removed".
 */
export function useScenePages(sceneId: string | undefined, storyId: string | undefined) {
  const db = useDrizzle();
  const [pages, setPages] = useState<ScenePageView[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!sceneId) {
      setPages([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await createScenePageService(db).getPagesForScene(sceneId);
      setPages(await Promise.all(rows.map((row) => scenePageViewOf(db, row))));
    } catch (error) {
      console.log('useScenePages: failed to load the pages.', error);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [db, sceneId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `reload` clears synchronously only when no scene is given; everything else waits for `await`.
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) void reload();
    };
    const events = ['scene_page_changed', 'sketch_changed', 'gallery_changed'] as const;
    for (const event of events) entityEventEmitter.on(event, onChange);
    return () => {
      for (const event of events) entityEventEmitter.off(event, onChange);
    };
  }, [reload, storyId]);

  return { pages, loading, reload };
}
