import { z } from 'zod';
import type { SpatialRect } from '../graphs/spatialCanvas';

/**
 * Freeform vector objects drawn over a Board or a Location Map: lines, regions, frames,
 * annotation shapes and icon stamps. They are presentation-only - unlike edges, they never
 * reference nodes and carry no story semantics - so one schema serves both surfaces and the
 * Skia renderer plus the SVG exporters share the geometry below.
 *
 * Overlay ids are local to the canvas document, in the same 8-Crockford alphabet as the
 * surfaces that embed them. Each content schema keeps enforcing uniqueness against its own
 * node/edge pools; this file only guarantees the shape of one overlay.
 */

/**
 * Same 8-Crockford alphabet as the boards and maps that embed overlays, declared here so
 * this module never imports a surface schema back (Board/LocationMap import this file).
 */
export const CANVAS_OVERLAY_LOCAL_ID_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export const MAX_CANVAS_OVERLAYS = 200;
export const MAX_CANVAS_OVERLAY_POINTS = 200;
export const MAX_CANVAS_OVERLAY_LABEL_LENGTH = 200;
/** Diameter of a stamp whose size was never set - slightly smaller than a map point. */
export const CANVAS_OVERLAY_STAMP_DEFAULT_SIZE = 36;
export const CANVAS_OVERLAY_SHAPES = ['rect', 'ellipse'] as const;
export type CanvasOverlayShape = (typeof CANVAS_OVERLAY_SHAPES)[number];

const CanvasOverlayLocalIdSchema = z
  .string()
  .regex(CANVAS_OVERLAY_LOCAL_ID_REGEX, 'Canvas overlay ids are 8 Crockford characters');

const CanvasOverlayPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/** Hex color; absent means the surface's default stroke. */
const CanvasOverlayColorSchema = z.string().max(20).nullable().optional();
const CanvasOverlayLabelSchema = z
  .string()
  .max(MAX_CANVAS_OVERLAY_LABEL_LENGTH)
  .nullable()
  .optional();
const CanvasOverlayStrokeWidthSchema = z.number().finite().min(0.5).max(24).optional();
/** Visual stacking order inside the canvas; absent values preserve document order. */
const CanvasOverlayZIndexSchema = z.number().finite().optional();

const CanvasOverlayLineSchema = z.object({
  id: CanvasOverlayLocalIdSchema,
  kind: z.literal('line'),
  points: z.array(CanvasOverlayPointSchema).min(2).max(MAX_CANVAS_OVERLAY_POINTS),
  label: CanvasOverlayLabelSchema,
  color: CanvasOverlayColorSchema,
  strokeWidth: CanvasOverlayStrokeWidthSchema,
  dashed: z.boolean().optional(),
  /** Draws an arrowhead at the last point, following the final segment. */
  directed: z.boolean().optional(),
  zIndex: CanvasOverlayZIndexSchema,
});

const CanvasOverlayPolygonSchema = z.object({
  id: CanvasOverlayLocalIdSchema,
  kind: z.literal('polygon'),
  points: z.array(CanvasOverlayPointSchema).min(3).max(MAX_CANVAS_OVERLAY_POINTS),
  label: CanvasOverlayLabelSchema,
  color: CanvasOverlayColorSchema,
  /** Regions start as outlines; set to fill with `fillOpacity`. */
  filled: z.boolean().optional(),
  dashed: z.boolean().optional(),
  /** Fill opacity of the region; honored only when `filled`, absent means the default. */
  fillOpacity: z.number().finite().min(0).max(1).optional(),
  strokeWidth: CanvasOverlayStrokeWidthSchema,
  zIndex: CanvasOverlayZIndexSchema,
});

const CanvasOverlayFrameSchema = z.object({
  id: CanvasOverlayLocalIdSchema,
  kind: z.literal('frame'),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  label: CanvasOverlayLabelSchema,
  color: CanvasOverlayColorSchema,
  /** Frames are dashed group outlines unless explicitly solid. */
  dashed: z.boolean().optional(),
  /** Fills the frame like a shape; absent means outline only. */
  filled: z.boolean().optional(),
  zIndex: CanvasOverlayZIndexSchema,
});

const CanvasOverlayShapeSchema = z.object({
  id: CanvasOverlayLocalIdSchema,
  kind: z.literal('shape'),
  shapeType: z.enum(CANVAS_OVERLAY_SHAPES),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  label: CanvasOverlayLabelSchema,
  color: CanvasOverlayColorSchema,
  filled: z.boolean().optional(),
  dashed: z.boolean().optional(),
  strokeWidth: CanvasOverlayStrokeWidthSchema,
  zIndex: CanvasOverlayZIndexSchema,
});

const CanvasOverlayStampSchema = z.object({
  id: CanvasOverlayLocalIdSchema,
  kind: z.literal('stamp'),
  /** Center of the stamp, like a map point - not its top-left corner. */
  x: z.number().finite(),
  y: z.number().finite(),
  size: z.number().finite().min(8).max(256).optional(),
  /** v1: an Ionicons glyph name from `metadata/mapIcons`; namespaced later (`ion:`/`keres:`). */
  icon: z.string().min(1).max(60),
  color: CanvasOverlayColorSchema,
  label: CanvasOverlayLabelSchema,
  zIndex: CanvasOverlayZIndexSchema,
});

export const CanvasOverlaySchema = z.discriminatedUnion('kind', [
  CanvasOverlayLineSchema,
  CanvasOverlayPolygonSchema,
  CanvasOverlayFrameSchema,
  CanvasOverlayShapeSchema,
  CanvasOverlayStampSchema,
]);

/** No defaults or transforms: the parsed overlay is exactly the stored overlay. */
export type CanvasOverlayType = z.infer<typeof CanvasOverlaySchema>;

/**
 * World-space bounds of one overlay. The content schemas feed this into the shared spatial
 * envelope guard; the renderers (Skia overlay, SVG export) reuse it for culling, so the
 * safety domain and the visible output can never disagree about an overlay's extent.
 */
export function canvasOverlayBounds(overlay: CanvasOverlayType): SpatialRect {
  switch (overlay.kind) {
    case 'line':
    case 'polygon': {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const point of overlay.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'frame':
    case 'shape':
      return { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height };
    case 'stamp': {
      const size = overlay.size ?? CANVAS_OVERLAY_STAMP_DEFAULT_SIZE;
      return { x: overlay.x - size / 2, y: overlay.y - size / 2, width: size, height: size };
    }
  }
}
