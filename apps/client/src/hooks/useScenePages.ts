import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { ScenePageSelect } from '@/src/db/schema';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createScenePageService } from '@/src/services/storymanagement/ScenePageService';
import { createSketchPreviewService } from '@/src/services/storymanagement/SketchPreviewService';
import { createSketchService } from '@/src/services/storymanagement/SketchService';
import type { SketchPreviewLook } from '@/src/services/storymanagement/SketchPreviewService';
import { useTheme } from '@/src/theme';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { sketchLookFromTheme } from './useSketchPreviewUri';

/** A page with what it shows: the Gallery medium or cached Sketch preview to draw, and its name. */
export interface ScenePageView {
  page: ScenePageSelect;
  /** The Gallery medium to draw: the page's own (`null` if it has none or is a Sketch). */
  thumbGalleryId: string | null;
  /**
   * The cached preview of a Sketch page under the current theme (`null` for Gallery pages and
   * while undrawn). The file lives outside the Gallery and never syncs.
   */
  thumbPreviewUri: string | null;
  mediaName: string | null;
  isSketch: boolean;
  /** The Sketch or medium it pointed at is gone (or never resolved): the page keeps only its text. */
  mediaGone: boolean;
}

export async function scenePageViewOf(
  db: ReturnType<typeof useDrizzle>,
  page: ScenePageSelect,
  look: SketchPreviewLook,
): Promise<ScenePageView> {
  if (page.galleryId) {
    const row = await createGalleryService(db).getById(page.galleryId);
    const alive = !!row && !row.isDeleted;
    return {
      page,
      thumbGalleryId: alive ? page.galleryId : null,
      thumbPreviewUri: null,
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
      thumbGalleryId: null,
      thumbPreviewUri: alive
        ? await createSketchPreviewService().peek(sketch.content, look)
        : null,
      mediaName: alive ? sketch.name : null,
      isSketch: true,
      mediaGone: !alive,
    };
  }
  return {
    page,
    thumbGalleryId: null,
    thumbPreviewUri: null,
    mediaName: null,
    isSketch: false,
    mediaGone: true,
  };
}

/**
 * A scene's pages, in order, each with what it shows. Reloads when pages, Sketches or the Gallery
 * change, so a page whose image was deleted on another device turns into "media removed".
 *
 * With `redrawFor` (the person who may edit), a Sketch page is also kept showing the drawing as
 * it is now: a missing preview is drawn in the background, one sketch at a time. The files live
 * outside the Gallery: picking a Sketch never adds a medium to it.
 */
export function useScenePages(
  sceneId: string | undefined,
  storyId: string | undefined,
  options: { redrawFor?: string | null } = {},
) {
  const redrawFor = options.redrawFor ?? null;
  const db = useDrizzle();
  const { colors } = useTheme();
  const look = useMemo(() => sketchLookFromTheme(colors), [colors]);
  const redrawing = useRef(false);
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
      const views = await Promise.all(rows.map((row) => scenePageViewOf(db, row, look)));
      setPages(views);
      if (redrawFor && !redrawing.current) {
        redrawing.current = true;
        let redrawn = false;
        try {
          const sketchIds = new Set(
            views.flatMap((view) =>
              view.isSketch && !view.mediaGone && view.page.sketchId ? [view.page.sketchId] : [],
            ),
          );
          const previews = createSketchPreviewService();
          const sketches = createSketchService(db);
          for (const sketchId of sketchIds) {
            const sketch = await sketches.getById(sketchId);
            if (!sketch || sketch.isDeleted) continue;
            if (!(await previews.ensure(sketch.name, sketch.content, look)).cached) redrawn = true;
          }
        } catch (error) {
          console.log('useScenePages: could not draw a Sketch page.', error);
        } finally {
          redrawing.current = false;
        }
        if (redrawn) {
          setPages(
            await Promise.all(
              (await createScenePageService(db).getPagesForScene(sceneId)).map((row) =>
                scenePageViewOf(db, row, look),
              ),
            ),
          );
        }
      }
    } catch (error) {
      console.log('useScenePages: failed to load the pages.', error);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [db, look, redrawFor, sceneId]);

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
