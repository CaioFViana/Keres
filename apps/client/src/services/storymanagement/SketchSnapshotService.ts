import {
  decodeSketchDocument,
  encodeSketchDocument,
  isSketchSnapshotFresh,
  sketchContentHash,
  type SketchDocument,
  validateSketchContent,
} from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import type { SketchSelect } from '../../db/schema';
import { renderSketchSvg } from '../../utils/sketchSvg';
import type { SvgExportColors } from '../../utils/svgExport';
import { buildSketchFileName } from '../../utils/storyTransfer';
import { fitRasterSize, rasterizeMapSvg } from '../../utils/svgRaster';
import { mediaFileService } from '../MediaFileService';
import { createGalleryService } from './GalleryService';
import { createSketchService } from './SketchService';

/** A snapshot is for the page, so it is drawn on light paper whatever theme the app is in. */
const PAPER_COLORS: SvgExportColors = {
  background: '#ffffff',
  surface: '#ffffff',
  text: '#1f1f1f',
  textSecondary: '#5a5a5a',
  border: '#c8c8c8',
  primary: '#3b5bdb',
};

/**
 * Draws the document to a PNG, keeps it in the story's Gallery (a byte-identical drawing reuses the
 * same file and row) and makes it the sketch's cover, remembering which drawing it is of.
 */
export async function saveSketchSnapshot(
  db: AppDrizzleClient,
  userId: string,
  sketch: SketchSelect,
  doc: SketchDocument,
  look: { colors: SvgExportColors; paper: string } = { colors: PAPER_COLORS, paper: '#ffffff' },
): Promise<SketchSelect> {
  const svg = renderSketchSvg(doc, { title: sketch.name, colors: look.colors, paper: look.paper });
  const pixels = fitRasterSize(doc.page.width, doc.page.height);
  const bytes = await rasterizeMapSvg(svg, pixels.width, pixels.height);
  const snapshot = await mediaFileService.saveSnapshot(sketch.storyId, 'image/png', bytes);
  const galleryService = createGalleryService(db);
  const existing = await galleryService.getByHash(sketch.storyId, snapshot.hash);
  const row =
    existing ??
    (await galleryService.createGallery(userId, {
      storyId: sketch.storyId,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: buildSketchFileName(sketch.name, 'png'),
      hash: snapshot.hash,
      sizeBytes: snapshot.sizeBytes,
      localPath: snapshot.localPath,
      title: sketch.name,
    }));
  return createSketchService(db).updateSketch(userId, sketch.id, {
    coverGalleryId: row.id,
    coverSourceHash: sketchContentHash(encodeSketchDocument(doc)),
  });
}

/**
 * The Gallery medium a page's Sketch is shown by: the sketch's cover while that is a snapshot of the
 * drawing as it is now, otherwise a new snapshot. Returns `null` for a sketch that is gone.
 */
export async function ensureSketchSnapshot(
  db: AppDrizzleClient,
  userId: string,
  sketchId: string,
): Promise<{ galleryId: string; regenerated: boolean } | null> {
  const sketch = await createSketchService(db).getById(sketchId);
  if (!sketch || sketch.isDeleted) return null;
  if (isSketchSnapshotFresh(sketch) && sketch.coverGalleryId) {
    return { galleryId: sketch.coverGalleryId, regenerated: false };
  }
  const doc = decodeSketchDocument(validateSketchContent(sketch.content));
  const updated = await saveSketchSnapshot(db, userId, sketch, doc);
  return updated.coverGalleryId ? { galleryId: updated.coverGalleryId, regenerated: true } : null;
}
