import type { CanvasOverlayPreset } from '@keres/shared/graphs/canvasOverlayGeometry';
import type { SpatialPoint } from '@keres/shared';

/**
 * What the canvas interaction layer is doing with the next gestures. Presets are drag
 * tools too: the user draws the region and the shape inscribes itself in it.
 */
export type OverlayDrawTool =
  | 'line'
  | 'polygon'
  | 'frame'
  | 'rect'
  | 'ellipse'
  | 'stamp'
  | `preset:${CanvasOverlayPreset}`;

export type OverlayInteractionMode =
  | { kind: 'draw'; tool: OverlayDrawTool }
  | { kind: 'select' }
  | null;

/** Values the add-objects pill emits; screens map them onto the overlay actions hook. */
export type AddObjectsAction =
  | 'note'
  | `draw:${OverlayDrawTool}`
  | `preset:${CanvasOverlayPreset}`
  | 'select';

export const RECT_DRAW_TOOLS: readonly OverlayDrawTool[] = ['frame', 'rect', 'ellipse'];

export function isPresetDrawTool(tool: OverlayDrawTool): tool is `preset:${CanvasOverlayPreset}` {
  return tool.startsWith('preset:');
}

/** Drag-a-rectangle tools (rect gestures), presets included. */
export function isRectDrawTool(tool: OverlayDrawTool): boolean {
  return (RECT_DRAW_TOOLS as readonly string[]).includes(tool) || isPresetDrawTool(tool);
}

/** In-progress line/polygon vertices, owned by the overlay actions hook. */
export interface OverlayDraft {
  tool: 'line' | 'polygon';
  points: readonly SpatialPoint[];
}

/** Canvas-to-screen overlay callbacks; the actions hook satisfies this structurally. */
export interface OverlayCanvasCallbacks {
  onDrawTap: (point: SpatialPoint) => void;
  onDrawRect: (tool: OverlayDrawTool, start: SpatialPoint, end: SpatialPoint) => void;
  /** Stamps commit on a single tap, free of the vertex snap, so they get their own tap. */
  onStampPlace: (point: SpatialPoint) => void;
  onSelectOverlay: (id: string | null) => void;
  /** Clears the selection but stays in select mode, for the next pick. */
  onDeselectOverlay: () => void;
  /** Opens the label/color editor for the selected overlay. */
  onOpenOverlaySheet: (id: string) => void;
  onMoveOverlayLayer: (id: string, direction: 'front' | 'back') => void;
  onCommitMove: (id: string, dx: number, dy: number) => void;
  onCommitVertex: (id: string, index: number, point: SpatialPoint) => void;
  onCommitRect: (
    id: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
}
