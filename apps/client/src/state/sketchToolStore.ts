import {
  SKETCH_BRUSHES,
  SKETCH_ERASER_MAX_SIZE,
  SKETCH_ERASER_MIN_SIZE,
  type LassoMode,
  type SketchBrushId,
} from '@keres/shared';
import { create } from 'zustand';

/** What the next single-finger gesture does on the canvas; `hand` leaves it to the camera. */
export type SketchTool =
  | 'hand'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'select'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'balloon'
  | 'stamp';

/** Tools that open an editable object (text, balloon, stamp) instead of drawing on a layer. */
export function isObjectTool(tool: SketchTool): boolean {
  return tool === 'text' || tool === 'balloon' || tool === 'stamp';
}

/** Tools that paint stroke items with the current brush (the shape tools draw with it too). */
export function isStrokeTool(tool: SketchTool): boolean {
  return tool === 'brush' || tool === 'line' || tool === 'rect' || tool === 'ellipse';
}

export const SKETCH_PALETTE = [
  '#111111',
  '#6b7280',
  '#ffffff',
  '#e03131',
  '#f08c00',
  '#fcc419',
  '#2f9e44',
  '#1098ad',
  '#1971c2',
  '#7048e8',
  '#c2255c',
  '#8d5524',
] as const;

const MAX_RECENT_COLORS = 8;

interface SketchToolState {
  tool: SketchTool;
  brush: SketchBrushId;
  color: string;
  /** Opacity of new strokes and fills (0-1), per brush so the marker stays translucent. */
  alphaByBrush: Record<SketchBrushId, number>;
  sizeByBrush: Record<SketchBrushId, number>;
  eraserSize: number;
  /** Largest channel difference a fill treats as "the same color" (0-255). */
  fillTolerance: number;
  /** Openings in the outline (world units) a fill treats as closed, so a hand-drawn ring still holds. */
  fillGap: number;
  /** Fill reads every visible layer when true, only the active layer otherwise. */
  fillSampleAll: boolean;
  lassoMode: LassoMode;
  recentColors: string[];
  setTool: (tool: SketchTool) => void;
  setBrush: (brush: SketchBrushId) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setAlpha: (alpha: number) => void;
  setEraserSize: (size: number) => void;
  setFillTolerance: (tolerance: number) => void;
  setFillGap: (gap: number) => void;
  setFillSampleAll: (all: boolean) => void;
  setLassoMode: (mode: LassoMode) => void;
  reset: () => void;
}

const initialState = () => ({
  tool: 'brush' as SketchTool,
  brush: 'pen' as SketchBrushId,
  color: '#111111',
  alphaByBrush: {
    pen: SKETCH_BRUSHES.pen.defaultAlpha,
    marker: SKETCH_BRUSHES.marker.defaultAlpha,
    highlighter: SKETCH_BRUSHES.highlighter.defaultAlpha,
  },
  sizeByBrush: {
    pen: SKETCH_BRUSHES.pen.defaultSize,
    marker: SKETCH_BRUSHES.marker.defaultSize,
    highlighter: SKETCH_BRUSHES.highlighter.defaultSize,
  },
  eraserSize: 24,
  fillTolerance: 40,
  fillGap: 5,
  fillSampleAll: true,
  lassoMode: 'whole' as LassoMode,
  recentColors: [] as string[],
});

export const useSketchToolStore = create<SketchToolState>((set, get) => ({
  ...initialState(),
  setTool: (tool) => set({ tool }),
  setBrush: (brush) => set({ brush, tool: 'brush' }),
  setColor: (color) =>
    set((state) => ({
      color,
      recentColors: [color, ...state.recentColors.filter((entry) => entry !== color)].slice(
        0,
        MAX_RECENT_COLORS,
      ),
    })),
  setSize: (size) => {
    const brush = get().brush;
    const spec = SKETCH_BRUSHES[brush];
    const clamped = Math.min(spec.maxSize, Math.max(spec.minSize, size));
    set((state) => ({ sizeByBrush: { ...state.sizeByBrush, [brush]: clamped } }));
  },
  setAlpha: (alpha) => {
    const brush = get().brush;
    const clamped = Math.min(1, Math.max(0.05, alpha));
    set((state) => ({ alphaByBrush: { ...state.alphaByBrush, [brush]: clamped } }));
  },
  setEraserSize: (size) =>
    set({ eraserSize: Math.min(SKETCH_ERASER_MAX_SIZE, Math.max(SKETCH_ERASER_MIN_SIZE, size)) }),
  setFillTolerance: (tolerance) => set({ fillTolerance: Math.min(255, Math.max(0, tolerance)) }),
  setFillGap: (gap) => set({ fillGap: Math.min(20, Math.max(0, Math.round(gap))) }),
  setFillSampleAll: (fillSampleAll) => set({ fillSampleAll }),
  setLassoMode: (lassoMode) => set({ lassoMode }),
  reset: () => set(initialState()),
}));
