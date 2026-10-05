/**
 * The drawing model of a Sketch layer: self-contained, transformable items (strokes and
 * fills), stored in draw order. There is no raster anywhere: a layer is replayed from its
 * items, the eraser cuts strokes geometrically, and a selection is just a subset of items.
 *
 * Items are immutable by convention: every edit builds new item objects and a new array, so
 * undo history can share unchanged items between snapshots by reference.
 */

export const SKETCH_BRUSH_IDS = ['pen', 'marker', 'highlighter'] as const;
export type SketchBrushId = (typeof SKETCH_BRUSH_IDS)[number];

export interface SketchBrushSpec {
  id: SketchBrushId;
  cap: 'round' | 'butt';
  /** Initial size/opacity when the brush is picked; the user can change both afterwards. */
  defaultSize: number;
  defaultAlpha: number;
  minSize: number;
  maxSize: number;
}

export const SKETCH_BRUSHES: Record<SketchBrushId, SketchBrushSpec> = {
  pen: { id: 'pen', cap: 'round', defaultSize: 3, defaultAlpha: 1, minSize: 0.5, maxSize: 60 },
  marker: {
    id: 'marker',
    cap: 'round',
    defaultSize: 12,
    defaultAlpha: 0.6,
    minSize: 2,
    maxSize: 120,
  },
  highlighter: {
    id: 'highlighter',
    cap: 'butt',
    defaultSize: 24,
    defaultAlpha: 0.35,
    minSize: 4,
    maxSize: 200,
  },
};

export const SKETCH_ERASER_MIN_SIZE = 2;
export const SKETCH_ERASER_MAX_SIZE = 200;

/** Coordinates and sizes are stored in quarter-pixel steps. */
export const SKETCH_QUANT = 4;

export interface SketchStroke {
  kind: 'stroke';
  brush: SketchBrushId;
  /** `#rrggbb`. */
  color: string;
  /** 0 to 1; stored as one byte. */
  alpha: number;
  /** Stroke width in world units. */
  size: number;
  /** Flat `[x0, y0, x1, y1, ...]`; at least one point (a single point is a dot). */
  points: number[];
}

export interface SketchFill {
  kind: 'fill';
  color: string;
  alpha: number;
  /** Closed rings, flat like stroke points. Painted even-odd, so inner rings are holes. */
  rings: number[][];
}

export type SketchItem = SketchStroke | SketchFill;

export interface SketchPoint {
  x: number;
  y: number;
}

/** Affine transform `[a c e; b d f]`, applied as `x' = a·x + c·y + e`, `y' = b·x + d·y + f`. */
export interface SketchMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const SKETCH_IDENTITY: SketchMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Ceilings that bound decoding, rendering and sync; mirrored by the schema. */
export const MAX_SKETCH_ITEMS_PER_LAYER = 30000;
export const MAX_SKETCH_POINTS_PER_STROKE = 20000;
export const MAX_SKETCH_RINGS_PER_FILL = 400;
export const MAX_SKETCH_POINTS_PER_RING = 20000;
/** Encoded (compressed + base64) characters one layer may take. */
export const MAX_SKETCH_LAYER_DATA_LENGTH = 1_500_000;
/** Same, across every layer of one sketch: the number the editor warns about. */
export const MAX_SKETCH_TOTAL_DATA_LENGTH = 2_500_000;
/** Inflated bytes a layer may expand to; a hard stop against decompression bombs. */
export const MAX_SKETCH_LAYER_DECODED_BYTES = 24 * 1024 * 1024;
