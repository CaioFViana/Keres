import type { SpatialPoint, SpatialRect } from '@keres/shared';

/** The shapes, limits and small pure helpers of the canvas camera; the hook itself is `useCanvasViewport`. */

export interface CanvasViewportHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
  viewportWorldCenter(): SpatialPoint;
  /** Harmless everywhere rotation is off; sketches use it for the reset control. */
  resetRotation(): void;
}

/**
 * The live camera as a transform triple - translate, then scale, top-left origin - matching
 * `animatedTransform` entry for entry, so a Skia `Group` fed with this reproduces the container
 * mapping bit for bit. Rotation-enabled canvases publish a 6-entry composition instead while
 * twisted (translate to center, rotate, translate back, scale); straight views keep the triple.
 */
export type CanvasCameraTransform =
  | [{ translateX: number }, { translateY: number }, { scale: number }]
  | [
      { translateX: number },
      { translateY: number },
      { rotate: number },
      { translateX: number },
      { translateY: number },
      { scale: number },
    ];

/** World-space frame of the drawing: bounds for a freeform canvas, layout size for a graph. */
export interface CanvasViewportBounds {
  /** World coordinate of the frame's left edge; layouts rooted at zero omit it. */
  x?: number;
  /** World coordinate of the frame's top edge; layouts rooted at zero omit it. */
  y?: number;
  width: number;
  height: number;
}

export type ClampMode =
  /** Freeform canvases: the camera roams; `fitToScreen` recovers a lost drawing. */
  | 'none'
  /** A strip of the drawing always stays on screen, so a small board can still slide. */
  | 'free'
  /** The drawing stays centred while it fits and cannot be dragged out of sight. */
  | 'contain';

export interface CanvasViewportOptions {
  minScale?: number;
  maxScale?: number;
  clampMode?: ClampMode;
  /** Matrices start at the top; graphs stay centred. */
  fitVerticalAlignment?: 'center' | 'top';
  /** Keeps the current position when the visualization's data changes. */
  refitOnLayoutChange?: boolean;
  /** Some visualizations, such as a timeline, must preserve the vertical scale and scroll horizontally. */
  fitMode?: 'contain' | 'height';
  /**
   * A tap that landed on the drawing, in its own coordinates (already undoing pan and zoom).
   *
   * It exists so that a canvas whose whole surface is meaningful - a timeline band, a matrix column -
   * can hit-test its own drawing instead of carpeting it with touch targets. Views that answer to
   * touch take the responder on the finger's way down, and a pinch that starts on one of them never
   * reaches the canvas: the map stops zooming as soon as the drawing covers the screen.
   */
  onTap?: (point: { x: number; y: number }) => void;
  /** Receives camera movement in world coordinates while an edge drag is auto-panning. */
  onAutoPan?: (delta: SpatialPoint) => void;
  /**
   * Sketch-only: a two-finger twist rotates the *view* around the viewport center (the
   * document stays axis-aligned, so sync and export never see it). Off everywhere else:
   * the camera contract stays translate+scale, and every formula below reduces to
   * today's exactly.
   */
  rotationEnabled?: boolean;
}

export const DEFAULT_MIN_SCALE = 0.15;
export const DEFAULT_MAX_SCALE = 2.5;
export const DRAG_THRESHOLD = 5;
export const FIT_MARGIN = 0.94;
export const FREE_PAN_KEEP = 64;
export const AUTO_PAN_EDGE = 56;
export const AUTO_PAN_MAX_SCREEN_SPEED = 720;

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

/** Wraps an angle to [-PI, PI]; successive twist deltas accumulate without winding up. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = (((angle + Math.PI) % twoPi) + twoPi) % twoPi;
  return wrapped - Math.PI;
}

export interface OverlayState {
  /** World coordinates of the overlay's top-left corner; the overlay is viewport-sized. */
  origin: SpatialPoint;
  width: number;
  height: number;
  /** World-space window the overlay covers; canvases cull and clip against it. */
  renderWindow: SpatialRect;
  /** Camera scale the overlay was synced at; a pinch drifting past it re-syncs. */
  scale: number;
}

/** Initial overlay surface before the first sync; shared by the ref mirror and the state. */
export function initialOverlayState(bounds: CanvasViewportBounds | null): OverlayState {
  return {
    origin: { x: bounds?.x ?? 0, y: bounds?.y ?? 0 },
    width: 0,
    height: 0,
    scale: 0,
    renderWindow: bounds
      ? {
          x: bounds.x ?? 0,
          y: bounds.y ?? 0,
          width: bounds.width,
          height: bounds.height,
        }
      : { x: 0, y: 0, width: 0, height: 0 },
  };
}
