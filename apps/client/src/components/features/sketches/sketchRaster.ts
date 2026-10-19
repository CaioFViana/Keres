import type { SketchDocument } from '@keres/shared';
import {
  AlphaType,
  ColorType,
  type SkImage,
  type SkSurface,
  Skia,
} from '@shopify/react-native-skia';
import { recordSketchPicture } from './sketchPictures';

/** Longest side of the scratch bitmap a fill or eyedropper reads; the stored result stays vector. */
const RASTER_MAX_SIDE = 1800;
const RASTER_MAX_SCALE = 2;

export interface SketchRaster {
  data: Uint8Array;
  width: number;
  height: number;
  /** Bitmap pixels per world unit. */
  scale: number;
}

export interface SketchRasterOptions {
  /** Layer read when `sampleAll` is off. */
  layerId: string;
  /** True: every visible layer over the paper. False: the active layer alone on transparent. */
  sampleAll: boolean;
  /** `#rrggbb` the page paints under the drawing (ignored when transparent / layer-only). */
  paperColor: string;
}

/**
 * Renders what the user sees (strokes and fills, no objects) into a scratch RGBA bitmap, only to
 * be read once by a bucket fill or the eyedropper. The bitmap is never stored; fills keep the
 * region's outline as rings. Null when the platform cannot make the surface.
 */
export function rasterizeSketch(
  doc: SketchDocument,
  options: SketchRasterOptions,
): SketchRaster | null {
  const { page } = doc;
  const scale = Math.min(RASTER_MAX_SCALE, RASTER_MAX_SIDE / Math.max(page.width, page.height));
  const width = Math.max(1, Math.round(page.width * scale));
  const height = Math.max(1, Math.round(page.height * scale));
  // A CPU surface on purpose: `MakeOffscreen` opens a WebGL context per call on the web and never
  // lets go of it, so a handful of fills ran the browser out of contexts and took Skia down.
  let surface: SkSurface | null = null;
  let image: SkImage | null = null;
  try {
    surface = Skia.Surface.Make(width, height);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(scale, scale);
    const paperVisible = options.sampleAll && page.background !== 'transparent';
    if (paperVisible)
      canvas.drawColor(Skia.Color(page.background === 'white' ? '#ffffff' : options.paperColor));
    for (const layer of doc.layers) {
      if (options.sampleAll ? !layer.visible : layer.id !== options.layerId) continue;
      canvas.drawPicture(recordSketchPicture(layer.items));
    }
    surface.flush();
    image = surface.makeImageSnapshot();
    const pixels = image.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    // Copied: the surface goes away below and the bitmap must outlive it.
    return pixels ? { data: new Uint8Array(pixels as Uint8Array), width, height, scale } : null;
  } catch (error) {
    console.log('rasterizeSketch: could not rasterize the sketch.', error);
    return null;
  } finally {
    image?.dispose();
    surface?.dispose();
  }
}

/** `#rrggbb` of the bitmap pixel under a world point, or null outside the page. */
export function sampleRasterColor(raster: SketchRaster, x: number, y: number): string | null {
  const px = Math.floor(x * raster.scale);
  const py = Math.floor(y * raster.scale);
  if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) return null;
  const offset = (py * raster.width + px) * 4;
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${hex(raster.data[offset])}${hex(raster.data[offset + 1])}${hex(raster.data[offset + 2])}`;
}
