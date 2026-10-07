import { useEffect, useState } from 'react';
import { useDrizzle } from '@/src/db';
import type { GallerySelect, SketchSelect } from '@/src/db/schema';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createSketchService } from '@/src/services/storymanagement/SketchService';

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

/** The story's Gallery images, read when `enabled` turns on (a picker opening). */
export function useGalleryImages(storyId: string | undefined, enabled: boolean) {
  const db = useDrizzle();
  const [images, setImages] = useState<GallerySelect[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !storyId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the spinner shows while the images load; everything else waits for `await`.
    setLoading(true);
    void createGalleryService(db)
      .getGalleriesByStoryId(storyId, { mediaTypes: ['image'] })
      .then((rows) => {
        if (alive) setImages(rows);
      })
      .catch(() => {
        if (alive) setImages([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, enabled, storyId]);

  return { images, loading };
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
        console.log('useScenePageChoices: failed to load the sketches.', error);
        if (alive) setSketches([]);
      });
    return () => {
      alive = false;
    };
  }, [db, enabled, storyId]);

  return { sketches, images, loading: loadingImages };
}
