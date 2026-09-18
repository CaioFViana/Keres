import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { Animated, PanResponder } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  spatialNativeSurface,
  spatialOverlayNeedsSync,
  spatialOverlayScaleDrifted,
  spatialRenderWindow,
  type SpatialPoint,
  type SpatialRect,
} from '@keres/shared';

export interface CanvasViewportHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
  viewportWorldCenter(): SpatialPoint;
}

/**
 * The live camera as a transform triple - translate, then scale, top-left origin - matching
 * `animatedTransform` entry for entry, so a Skia `Group` fed with this reproduces the container
 * mapping bit for bit.
 */
export type CanvasCameraTransform = [
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

type ClampMode =
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
}

const DEFAULT_MIN_SCALE = 0.15;
const DEFAULT_MAX_SCALE = 2.5;
const DRAG_THRESHOLD = 5;
const FIT_MARGIN = 0.94;
const FREE_PAN_KEEP = 64;
const AUTO_PAN_EDGE = 56;
const AUTO_PAN_MAX_SCREEN_SPEED = 720;

interface Transform {
  scale: number;
  x: number;
  y: number;
}

interface OverlayState {
  /** World coordinates of the overlay's top-left corner; the overlay is viewport-sized. */
  origin: SpatialPoint;
  width: number;
  height: number;
  /** World-space window the overlay covers; canvases cull and clip against it. */
  renderWindow: SpatialRect;
  /** Camera scale the overlay was synced at; a pinch drifting past it re-syncs. */
  scale: number;
}

/**
 * Pan and zoom for every canvas in the app: boards and location maps as well as the story,
 * location, relation, matrix and timeline drawings.
 *
 * One rule governs the whole design: children are world-addressed and the camera lives ONLY in
 * the container transform. A gesture writes refs and `Animated` values; it never moves a child's
 * layout position, so there is no second channel that could commit a frame late and make the
 * drawing teleport - the failure the previous origin-rebasing viewport had on Android, where a
 * React commit (Yoga + Fabric + SVG serialization) lands whole frames after the native transform.
 *
 * The only React state a gesture may touch is the overlay: the viewport-sized edges surface plus
 * the culling window. Re-syncing it moves nothing on screen (the SVG recenters against its own
 * internal transform in the same commit, and culling only mounts/unmounts off-screen items), and
 * hysteresis keeps the re-render off the gesture's critical path.
 */
export function useCanvasViewport(
  ref: React.ForwardedRef<CanvasViewportHandle>,
  bounds: CanvasViewportBounds | null,
  options: CanvasViewportOptions = {},
) {
  const minScaleOption = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const clampMode = options.clampMode ?? 'contain';
  const fitVerticalAlignment = options.fitVerticalAlignment ?? 'center';
  const refitOnLayoutChange = options.refitOnLayoutChange ?? true;
  const fitMode = options.fitMode ?? 'contain';
  /** In refs so that changing a handler does not rebuild the `PanResponder` mid-gesture. */
  const onTap = useRef(options.onTap);
  onTap.current = options.onTap;
  const autoPanHandler = useRef(options.onAutoPan);
  autoPanHandler.current = options.onAutoPan;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const containerRef = useRef<View>(null);
  const viewport = useRef({ width: 0, height: 0 });
  /** The canvas's corner within the window, to convert the pinch's focus into local coordinates. */
  const viewportOrigin = useRef({ x: 0, y: 0 });

  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;
  /**
   * The live camera mirrored to a shared value. The Skia edge overlay is a sibling of the
   * animated plane (sizing it inside the scaled plane would need world-unit layout and rebuild
   * the giant bitmap on the GPU), so it cannot inherit the camera - it reads this mirror on the
   * UI thread instead, tracking gestures with no React commit and no desync from the nodes.
   */
  const cameraTransform: SharedValue<CanvasCameraTransform> =
    useSharedValue<CanvasCameraTransform>([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }]);
  /** Live scale mirrored to state only outside gestures, for drag math and child props. */
  const [scaleState, setScaleState] = useState(1);

  const overlayRef = useRef<OverlayState>({
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
  });
  const [overlay, setOverlay] = useState<OverlayState>(overlayRef.current);

  /**
   * A child (a board pin) that is dragging must keep the responder. Capture would steal the
   * gesture as soon as the finger moved past DRAG_THRESHOLD, and the pin would never move.
   * Two-finger pinch still belongs to the canvas even then.
   */
  const childDragging = useRef(false);
  /** Estado do gesto em andamento; zerado a cada toque novo. */
  const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
  /** The gesture still qualifies as a tap: one finger, and no drag so far. */
  const tapping = useRef(false);
  /** The identity of the last bounds already framed, so as not to reframe on every render. */
  const fittedBounds = useRef<CanvasViewportBounds | null>(null);
  const autoPan = useRef({ x: 0, y: 0, frame: null as number | null, timestamp: 0 });
  const autoPanFrameRef = useRef<((timestamp: number) => void) | null>(null);

  const publish = useCallback(() => {
    animatedScale.setValue(transform.current.scale);
    animatedX.setValue(transform.current.x);
    animatedY.setValue(transform.current.y);
    cameraTransform.value = [
      { translateX: transform.current.x },
      { translateY: transform.current.y },
      { scale: transform.current.scale },
    ];
  }, [animatedScale, animatedX, animatedY, cameraTransform]);

  const cameraTopLeft = useCallback((): SpatialPoint => {
    const scale = transform.current.scale === 0 ? 1 : transform.current.scale;
    return {
      x: (0 - transform.current.x) / scale,
      y: (0 - transform.current.y) / scale,
    };
  }, []);

  const visibleWorldRect = useCallback((): SpatialRect => {
    const { width, height } = viewport.current;
    const scale = transform.current.scale === 0 ? 1 : transform.current.scale;
    const topLeft = cameraTopLeft();
    return { x: topLeft.x, y: topLeft.y, width: width / scale, height: height / scale };
  }, [cameraTopLeft]);

  /**
   * Re-covers the camera with the viewport-sized overlay. Safe mid-gesture by construction: it
   * only moves the edges surface (which compensates internally in the same commit) and the
   * culling window (which only affects off-screen items). Hysteresis keeps it rare.
   */
  const syncOverlays = useCallback(
    (force = false) => {
      const { width, height } = viewport.current;
      if (!width || !height) return;
      const scale = transform.current.scale === 0 ? 1 : transform.current.scale;
      const surface = spatialNativeSurface(width, height);
      const current = overlayRef.current;
      const currentWindow: SpatialRect =
        current.width > 0 && current.height > 0
          ? current.renderWindow
          : { x: 0, y: 0, width: 0, height: 0 };
      if (
        !force &&
        current.width === surface.width &&
        current.height === surface.height &&
        !spatialOverlayScaleDrifted(scale, current.scale) &&
        !spatialOverlayNeedsSync(visibleWorldRect(), currentWindow)
      ) {
        return;
      }
      const camera = cameraTopLeft();
      const origin = {
        x: camera.x - surface.overscanX / scale,
        y: camera.y - surface.overscanY / scale,
      };
      const next: OverlayState = {
        origin,
        width: surface.width,
        height: surface.height,
        scale,
        renderWindow: spatialRenderWindow(origin, surface.width, surface.height, scale),
      };
      overlayRef.current = next;
      setOverlay(next);
    },
    [cameraTopLeft, visibleWorldRect],
  );

  /**
   * Keeps the drawing reachable. `contain` centres a drawing that fits and never lets a bigger
   * one out of sight; `free` only insists that a strip stays on screen; `none` leaves the
   * camera alone (freeform canvases roam, and `fitToScreen` recovers a lost drawing).
   */
  const clamp = useCallback(() => {
    if (clampMode === 'none') return;
    const { width: viewportWidth, height: viewportHeight } = viewport.current;
    if (viewportWidth === 0 || viewportHeight === 0) return;
    const frame = boundsRef.current;
    if (!frame || frame.width <= 0 || frame.height <= 0) return;

    const scale = transform.current.scale;
    const drawingLeft = (frame.x ?? 0) * scale;
    const drawingTop = (frame.y ?? 0) * scale;
    const scaledWidth = frame.width * scale;
    const scaledHeight = frame.height * scale;

    if (clampMode === 'free') {
      transform.current.x = Math.min(
        viewportWidth - FREE_PAN_KEEP - drawingLeft,
        Math.max(FREE_PAN_KEEP - drawingLeft - scaledWidth, transform.current.x),
      );
      transform.current.y = Math.min(
        viewportHeight - FREE_PAN_KEEP - drawingTop,
        Math.max(FREE_PAN_KEEP - drawingTop - scaledHeight, transform.current.y),
      );
      return;
    }

    transform.current.x =
      scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2 - drawingLeft
        : Math.min(
            0 - drawingLeft,
            Math.max(viewportWidth - drawingLeft - scaledWidth, transform.current.x),
          );
    transform.current.y =
      scaledHeight <= viewportHeight
        ? (fitVerticalAlignment === 'top' ? 0 : (viewportHeight - scaledHeight) / 2) - drawingTop
        : Math.min(
            0 - drawingTop,
            Math.max(viewportHeight - drawingTop - scaledHeight, transform.current.y),
          );
  }, [clampMode, fitVerticalAlignment]);

  /** Applies a zoom keeping fixed the point of the drawing that lies under `focus`. */
  const zoomAround = useCallback(
    (nextScale: number, focus: { x: number; y: number }) => {
      const previous = transform.current.scale;
      const clamped = Math.max(minScaleOption, Math.min(maxScale, nextScale));
      if (clamped === previous) return;
      transform.current.x = focus.x - ((focus.x - transform.current.x) * clamped) / previous;
      transform.current.y = focus.y - ((focus.y - transform.current.y) * clamped) / previous;
      transform.current.scale = clamped;
      clamp();
      publish();
    },
    [clamp, maxScale, minScaleOption, publish],
  );

  const fitToScreen = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = viewport.current;
    if (viewportWidth === 0 || viewportHeight === 0) return;
    const frame = boundsRef.current;
    if (frame && (frame.width <= 0 || frame.height <= 0)) return;
    const containedScale = frame
      ? Math.min(viewportWidth / frame.width, viewportHeight / frame.height)
      : 1;
    const targetScale =
      frame && fitMode === 'height' ? viewportHeight / frame.height : containedScale;
    const scale = Math.max(minScaleOption, Math.min(maxScale, targetScale * FIT_MARGIN));
    const scaledWidth = frame ? frame.width * scale : 0;
    transform.current = {
      scale,
      // Centring only makes sense when the drawing fits. Wider than the window - a timeline,
      // a matrix - centring cuts both sides off, and the left-hand side is where
      // the scene and thread names live. In that case the framing starts at the beginning.
      x: frame
        ? (scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0) -
          (frame.x ?? 0) * scale
        : viewportWidth / 2,
      y: frame
        ? (fitVerticalAlignment === 'top' ? 0 : (viewportHeight - frame.height * scale) / 2) -
          (frame.y ?? 0) * scale
        : viewportHeight / 2,
    };
    clamp();
    publish();
    setScaleState(transform.current.scale);
    syncOverlays(true);
  }, [clamp, fitMode, fitVerticalAlignment, maxScale, minScaleOption, publish, syncOverlays]);

  const viewportWorldCenter = useCallback((): SpatialPoint => {
    const { width, height } = viewport.current;
    const scale = transform.current.scale;
    if (!width || !height || !scale) return { x: 0, y: 0 };
    const topLeft = cameraTopLeft();
    return { x: topLeft.x + width / (2 * scale), y: topLeft.y + height / (2 * scale) };
  }, [cameraTopLeft]);

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen,
      zoomBy: (factor: number) => {
        zoomAround(transform.current.scale * factor, {
          x: viewport.current.width / 2,
          y: viewport.current.height / 2,
        });
        setScaleState(transform.current.scale);
        syncOverlays();
      },
      viewportWorldCenter,
    }),
    [fitToScreen, syncOverlays, viewportWorldCenter, zoomAround],
  );

  const stopAutoPan = useCallback(() => {
    if (autoPan.current.frame !== null) cancelAnimationFrame(autoPan.current.frame);
    autoPan.current = { x: 0, y: 0, frame: null, timestamp: 0 };
  }, []);

  const autoPanFrame = useCallback(
    (timestamp: number) => {
      const state = autoPan.current;
      state.frame = null;
      if (!state.x && !state.y) return;
      const elapsed = Math.min(48, Math.max(1, timestamp - state.timestamp || 16));
      state.timestamp = timestamp;
      const before = cameraTopLeft();
      transform.current.x -= (state.x * (AUTO_PAN_MAX_SCREEN_SPEED * elapsed)) / 1000;
      transform.current.y -= (state.y * (AUTO_PAN_MAX_SCREEN_SPEED * elapsed)) / 1000;
      clamp();
      const after = cameraTopLeft();
      autoPanHandler.current?.({ x: after.x - before.x, y: after.y - before.y });
      publish();
      syncOverlays();
      state.frame = requestAnimationFrame((nextTimestamp) =>
        autoPanFrameRef.current?.(nextTimestamp),
      );
    },
    [cameraTopLeft, clamp, publish, syncOverlays],
  );
  autoPanFrameRef.current = autoPanFrame;

  const updateAutoPan = useCallback(
    (screenPoint: SpatialPoint) => {
      const { width, height } = viewport.current;
      const edgeFactor = (value: number, size: number) => {
        if (value < AUTO_PAN_EDGE) return -(1 - value / AUTO_PAN_EDGE);
        if (value > size - AUTO_PAN_EDGE) return (value - (size - AUTO_PAN_EDGE)) / AUTO_PAN_EDGE;
        return 0;
      };
      const x = width ? edgeFactor(screenPoint.x, width) : 0;
      const y = height ? edgeFactor(screenPoint.y, height) : 0;
      autoPan.current.x = x;
      autoPan.current.y = y;
      if ((x || y) && autoPan.current.frame === null) {
        autoPan.current.timestamp = 0;
        autoPan.current.frame = requestAnimationFrame((timestamp) =>
          autoPanFrameRef.current?.(timestamp),
        );
      }
      if (!x && !y) stopAutoPan();
    },
    [stopAutoPan],
  );

  useEffect(() => stopAutoPan, [stopAutoPan]);

  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      viewportOrigin.current = { x, y };
      const wasEmpty = viewport.current.width === 0 || viewport.current.height === 0;
      viewport.current = { width, height };
      // The first framing is only possible once the window's size is known, which
      // happens after the first render.
      if (wasEmpty) {
        fittedBounds.current = boundsRef.current;
        fitToScreen();
      } else if (refitOnLayoutChange && fittedBounds.current !== boundsRef.current) {
        fittedBounds.current = boundsRef.current;
        fitToScreen();
      } else {
        syncOverlays(true);
      }
    });
  }, [fitToScreen, refitOnLayoutChange, syncOverlays]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // It does not capture the touch's start: that way a simple tap reaches the node and opens the
        // details. The drag is stolen from the node later, in the move's capture phase.
        onStartShouldSetPanResponderCapture: () => false,
        // Whatever no child claimed belongs to the canvas, from the finger's way down: pan, pinch and
        // `onTap` all start here, instead of the gesture being dropped for want of an owner.
        onStartShouldSetPanResponder: () => !childDragging.current,
        onMoveShouldSetPanResponder: (event, gestureState) => {
          const touches = event.nativeEvent.touches ?? [];
          if (touches.length > 1) return true;
          if (childDragging.current) return false;
          return Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD;
        },
        onMoveShouldSetPanResponderCapture: (event, gestureState) => {
          const touches = event.nativeEvent.touches ?? [];
          if (touches.length > 1) return true;
          if (childDragging.current) return false;
          return Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD;
        },

        onPanResponderGrant: (event) => {
          stopAutoPan();
          gesture.current = {
            lastDx: 0,
            lastDy: 0,
            pinchDistance: 0,
            pinchScale: transform.current.scale,
          };
          tapping.current = (event?.nativeEvent?.touches?.length ?? 1) <= 1;
          const pointerId = (event?.nativeEvent as { pointerId?: number } | undefined)?.pointerId;
          const target = event?.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.setPointerCapture?.(pointerId);
        },

        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches ?? [];

          if (touches.length >= 2) {
            tapping.current = false;
            const [first, second] = touches;
            const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
            const focus = {
              x: (first.pageX + second.pageX) / 2 - viewportOrigin.current.x,
              y: (first.pageY + second.pageY) / 2 - viewportOrigin.current.y,
            };

            if (gesture.current.pinchDistance === 0) {
              gesture.current.pinchDistance = distance;
              gesture.current.pinchScale = transform.current.scale;
            } else if (distance > 0) {
              zoomAround(
                (gesture.current.pinchScale * distance) / gesture.current.pinchDistance,
                focus,
              );
              syncOverlays();
            }
            // Zeroes the drag so the finger leaving the pinch does not make the map jump.
            gesture.current.lastDx = gestureState.dx;
            gesture.current.lastDy = gestureState.dy;
            return;
          }

          gesture.current.pinchDistance = 0;
          if (Math.hypot(gestureState.dx, gestureState.dy) > DRAG_THRESHOLD)
            tapping.current = false;
          transform.current.x += gestureState.dx - gesture.current.lastDx;
          transform.current.y += gestureState.dy - gesture.current.lastDy;
          gesture.current.lastDx = gestureState.dx;
          gesture.current.lastDy = gestureState.dy;
          clamp();
          publish();
          syncOverlays();
        },

        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event, gestureState) => {
          const pointerId = (event?.nativeEvent as { pointerId?: number } | undefined)?.pointerId;
          const target = event?.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          gesture.current.pinchDistance = 0;
          setScaleState(transform.current.scale);
          syncOverlays();
          const wasTap =
            tapping.current && Math.hypot(gestureState.dx, gestureState.dy) <= DRAG_THRESHOLD;
          tapping.current = false;
          if (!wasTap || !onTap.current) return;
          const { pageX, pageY } = event.nativeEvent;
          onTap.current({
            x: (pageX - viewportOrigin.current.x - transform.current.x) / transform.current.scale,
            y: (pageY - viewportOrigin.current.y - transform.current.y) / transform.current.scale,
          });
        },
        onPanResponderTerminate: () => {
          gesture.current.pinchDistance = 0;
          tapping.current = false;
        },
      }),
    [clamp, publish, stopAutoPan, syncOverlays, zoomAround],
  );

  return {
    containerRef,
    handleLayout,
    panHandlers: panResponder.panHandlers,
    animatedTransform: [
      { translateX: animatedX },
      { translateY: animatedY },
      { scale: animatedScale },
    ],
    /** Live camera for the Skia edge overlay; written in `publish`, never via React state. */
    cameraTransform,
    setChildDragging: (dragging: boolean) => {
      childDragging.current = dragging;
      if (!dragging) stopAutoPan();
    },
    getTransform: () => ({ ...transform.current }),
    /**
     * Viewport-sized overlay surface in screen pixels: the native bitmap budget (capped for the
     * GPU), never the document bounds. The edges Svg itself is world-sized from `renderWindow` -
     * handing it these screen pixels would clip every edge outside a scale-1.0 bitmap.
     */
    width: overlay.width,
    height: overlay.height,
    /** World coordinates of the overlay's top-left corner. */
    svgOrigin: overlay.origin,
    /** World-space window the overlay covers; canvases cull and clip against it. */
    renderWindow: overlay.renderWindow,
    /** Live scale, mirrored to state outside gestures for drag math and child props. */
    scale: scaleState,
    worldToScreen: (point: SpatialPoint): SpatialPoint => ({
      x: point.x * transform.current.scale + transform.current.x,
      y: point.y * transform.current.scale + transform.current.y,
    }),
    screenToWorld: (point: SpatialPoint): SpatialPoint => {
      const scale = transform.current.scale === 0 ? 1 : transform.current.scale;
      return {
        x: (point.x - transform.current.x) / scale,
        y: (point.y - transform.current.y) / scale,
      };
    },
    viewportWorldCenter,
    updateAutoPan,
    stopAutoPan,
  };
}
