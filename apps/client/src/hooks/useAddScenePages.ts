import {
  emptySketchContent,
  generateSketchLocalId,
  MAX_SKETCH_TITLE_LENGTH,
  type PageFormat,
} from '@keres/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '@/src/db';
import { importPickedMediaAssets } from '@/src/services/galleryMediaImport';
import { mediaFileService } from '@/src/services/MediaFileService';
import { createGalleryService } from '@/src/services/storymanagement/GalleryService';
import { createSketchService } from '@/src/services/storymanagement/SketchService';
import { sketchSizeForPageFormat } from '@/src/utils/sketchPageSize';

/** What picking pictures came to: the Gallery media they are now, in the order they were chosen. */
export interface UploadedPictures {
  galleryIds: string[];
  /** Files the Gallery could not take (a format it does not read, a file it could not copy). */
  rejected: number;
  /** The picker was closed without choosing: nothing to say. */
  cancelled: boolean;
}

/**
 * The two ways to make the picture of a page from scratch: a blank Sketch cut to the work's page,
 * and pictures chosen on the device, each of which goes into the Gallery first.
 */
export function useAddScenePages({
  storyId,
  userId,
  pageFormat,
}: {
  storyId: string | undefined;
  userId: string | null;
  pageFormat: PageFormat | null;
}) {
  const { t } = useTranslation();
  const db = useDrizzle();

  /** A new Sketch, blank, in the shape of the work's page. Returns its id. */
  const drawNewPage = useCallback(
    async (name: string): Promise<string | null> => {
      if (!storyId || !userId) return null;
      const size = sketchSizeForPageFormat(pageFormat ?? 'a5');
      const sketch = await createSketchService(db).createSketch(userId, {
        storyId,
        name: name.slice(0, MAX_SKETCH_TITLE_LENGTH),
        description: null,
        content: emptySketchContent(
          generateSketchLocalId(new Set()),
          t('sketch_layer_default_name', { count: 1 }),
          { ...size, background: 'paper' },
        ),
      });
      return sketch.id;
    },
    [db, pageFormat, storyId, t, userId],
  );

  /** Lets the person choose pictures and brings them into the Gallery. */
  const uploadPictures = useCallback(async (): Promise<UploadedPictures> => {
    if (!storyId || !userId) return { galleryIds: [], rejected: 0, cancelled: true };
    const assets = await mediaFileService.pickImages();
    if (!assets) return { galleryIds: [], rejected: 0, cancelled: true };
    const summary = await importPickedMediaAssets(
      createGalleryService(db),
      storyId,
      userId,
      assets,
    );
    return { galleryIds: summary.galleryIds, rejected: summary.rejected, cancelled: false };
  }, [db, storyId, userId]);

  return { drawNewPage, uploadPictures };
}
