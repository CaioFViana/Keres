import type { SketchContentType } from '../schemas/SketchSchemas';

/**
 * A drawing board page: strokes and fills in layers, plus text, balloons and stamps. The
 * drawing lives in `content`, not as its own sync entities — see `SketchSchemas.ts`. A gallery snapshot of the sketch (`coverGalleryId`) is only a
 * row-level link to a Gallery medium, never part of the drawing.
 */
export interface Sketch {
  id: string;
  storyId: string;
  name: string;
  description: string | null;
  content: SketchContentType;
  coverGalleryId: string | null;
  /**
   * Hash of the drawing the cover is a snapshot of (`sketchContentHash`); `null` for a cover that
   * predates it. The snapshot is fresh while this still matches the content.
   */
  coverSourceHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
