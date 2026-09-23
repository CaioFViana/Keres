import type { CanvasOverlayPreset } from '@keres/shared/graphs/canvasOverlayGeometry';
import type { SpatialPoint } from '@keres/shared';

/** What the canvas interaction layer is doing with the next gestures. */
export type OverlayDrawTool = 'line' | 'polygon' | 'frame' | 'rect' | 'ellipse';

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

export function isRectDrawTool(tool: OverlayDrawTool): boolean {
  return (RECT_DRAW_TOOLS as readonly string[]).includes(tool);
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
  onSelectOverlay: (id: string | null) => void;
  onCommitMove: (id: string, dx: number, dy: number) => void;
  onCommitVertex: (id: string, index: number, point: SpatialPoint) => void;
  onCommitRect: (
    id: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
}
