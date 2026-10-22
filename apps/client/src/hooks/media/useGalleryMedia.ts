import type { MediaType } from '@keres/shared';
import { useEffect, useMemo, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { GallerySelect, SketchSelect } from '@/src/db/schema';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import { createGalleryService } from '@/src/services/storymanagement/media-music/GalleryService';
import { createSketchService } from '@/src/services/storymanagement/media-music/SketchService';
import { logger } from '@/src/utils/logging/logger';

const IMAGE_TYPES: readonly MediaType[] = ['image'];
const NO_MEDIA: GallerySelect[] = [];

/** One Gallery medium by id: `null` while loading, when there is none, and when it was deleted. */
export function useGalleryRow(galleryId: string | null | undefined): GallerySelect | null {
  const db = useDrizzle();
  const [row, setRow] = useState<GallerySelect | null>(null);

  useEffect(() => {
    let alive = true;
    if (!galleryId) return;
    void createGalleryService(db)
      .getById(galleryId)
      .then((found) => {
        if (alive) setRow(found && !found.isDeleted ? found : null);
      })
      .catch(() => {
        if (alive) setRow(null);
      });
    return () => {
      alive = false;
    };
  }, [db, galleryId]);

  // A row kept from an earlier id never shows for another.
  return galleryId && row && row.id === galleryId ? row : null;
}

/** The story's Gallery media of some kinds, read when `enabled` turns on (a picker opening). */
export function useGalleryMedia(
  storyId: string | undefined,
  enabled: boolean,
  mediaTypes: readonly MediaType[],
) {
  const db = useDrizzle();
  // The kinds are compared by value, so a caller can pass a fresh array every render.
  const kinds = mediaTypes.join(',');
  const load = useMemo(
    () =>
      enabled && storyId
        ? () =>
            createGalleryService(db).getGalleriesByStoryId(storyId, {
              mediaTypes: kinds.split(',') as MediaType[],
            })
        : null,
    [db, enabled, kinds, storyId],
  );
  const { data: media, loading } = useLoadedResource({
    load,
    initial: NO_MEDIA,
    label: 'the Gallery media',
    quiet: true,
  });
  return { media, loading };
}

/** The story's Gallery images, read when `enabled` turns on (a picker opening). */
export function useGalleryImages(storyId: string | undefined, enabled: boolean) {
  const { media, loading } = useGalleryMedia(storyId, enabled, IMAGE_TYPES);
  return { images: media, loading };
}

/** What a scene page can show: the story's Sketches and its Gallery images, read when `enabled` turns on. */
export function useScenePageChoices(storyId: string | undefined, enabled: boolean) {
  const db = useDrizzle();
  const { images, loading: loadingImages } = useGalleryImages(storyId, enabled);
  const [sketches, setSketches] = useState<SketchSelect[]>([]);

  useEffect(() => {
    if (!enabled || !storyId) return;
    let alive = true;
    void createSketchService(db)
      .getSketchesForStory(storyId)
      .then((rows) => {
        if (alive) setSketches(rows);
      })
      .catch((error) => {
        logger.debug('useScenePageChoices: failed to load the sketches.', error);
        if (alive) setSketches([]);
      });
    return () => {
      alive = false;
    };
  }, [db, enabled, storyId]);

  return { sketches, images, loading: loadingImages };
}
