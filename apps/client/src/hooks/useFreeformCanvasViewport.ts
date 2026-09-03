import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { Animated, PanResponder } from 'react-native';
import {
  spatialNativeSurface,
  spatialRenderWindow,
  spatialScreenToWorld,
  spatialWorldToScreen,
  type SpatialPoint,
  type SpatialRect,
} from '@keres/shared';

export interface FreeformCanvasHandle {
  fitToScreen(): void;
  zoomBy(factor: number): void;
  viewportWorldCenter(): SpatialPoint;
}

interface FreeformCanvasViewportOptions {
  bounds: SpatialRect | null;
  minScale?: number;
  maxScale?: number;
  /** Receives camera movement in world coordinates while an edge drag is auto-panning. */
  onAutoPan?: (delta: SpatialPoint) => void;
}

const DEFAULT_MIN_SCALE = 0.15;
const DEFAULT_MAX_SCALE = 2.5;
const DRAG_THRESHOLD = 5;
const FIT_MARGIN = 0.94;
const AUTO_PAN_EDGE = 56;
const AUTO_PAN_MAX_SCREEN_SPEED = 720;
const MATERIAL_ZOOM = 1.25;

interface Transform {
  /** Extra scale on top of the baked local-plane scale; 1 except during a live pinch. */
  scale: number;
  x: number;
  y: number;
}

interface WindowState {
  origin: SpatialPoint;
  bakedScale: number;
  surfaceWidth: number;
  surfaceHeight: number;
  renderWindow: SpatialRect;
}

/**
 * A finite native surface over an unbounded-looking world. The View/SVG stay near the device
 * viewport; pan and pinch write Animated values only until the camera leaves the overscan.
 */
export function useFreeformCanvasViewport(
  ref: React.ForwardedRef<FreeformCanvasHandle>,
  options: FreeformCanvasViewportOptions,
) {
  const boundsRef = useRef(options.bounds);
  boundsRef.current = options.bounds;
  const autoPanHandler = useRef(options.onAutoPan);
  autoPanHandler.current = options.onAutoPan;
  const minScaleOption = options.minScale ?? DEFAULT_MIN_SCALE;
  const maxScale = options.maxScale ?? DEFAULT_MAX_SCALE;
  const containerRef = useRef<View>(null);
  const viewport = useRef({ width: 0, height: 0 });
  const viewportOrigin = useRef({ x: 0, y: 0 });
  const originRef = useRef<SpatialPoint>({ x: 0, y: 0 });
  const bakedScaleRef = useRef(1);
  const [windowState, setWindowState] = useState<WindowState>({
    origin: originRef.current,
    bakedScale: 1,
    surfaceWidth: 0,
    surfaceHeight: 0,
    renderWindow: { x: 0, y: 0, width: 0, height: 0 },
  });
  const [scaleState, setScaleState] = useState(1);
  const childDragging = useRef(false);
  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedY = useRef(new Animated.Value(0)).current;
  const gesture = useRef({ lastDx: 0, lastDy: 0, pinchDistance: 0, pinchScale: 1 });
  const tapping = useRef(false);
  const autoPan = useRef({ x: 0, y: 0, frame: null as number | null, timestamp: 0 });
  const autoPanFrameRef = useRef<((timestamp: number) => void) | null>(null);

  const currentScale = useCallback(() => bakedScaleRef.current * transform.current.scale, []);

  const minScale = useCallback(() => minScaleOption, [minScaleOption]);

  const publish = useCallback(() => {
    animatedScale.setValue(transform.current.scale);
    animatedX.setValue(transform.current.x);
    animatedY.setValue(transform.current.y);
  }, [animatedScale, animatedX, animatedY]);

  const cameraTopLeft = useCallback((): SpatialPoint => {
    return spatialScreenToWorld({ x: 0, y: 0 }, originRef.current, currentScale(), {
      x: transform.current.x,
      y: transform.current.y,
    });
  }, [currentScale]);

  const commitWindow = useCallback(
    (origin: SpatialPoint, bakedScale: number, extra: number, pan: SpatialPoint) => {
      const { width, height } = viewport.current;
      const surface = spatialNativeSurface(width, height);
      originRef.current = origin;
      bakedScaleRef.current = bakedScale;
      transform.current = { scale: extra, x: pan.x, y: pan.y };
      const renderWindow = spatialRenderWindow(origin, surface.width, surface.height, bakedScale);
      setWindowState({
        origin,
        bakedScale,
        surfaceWidth: surface.width,
        surfaceHeight: surface.height,
        renderWindow,
      });
      setScaleState(bakedScale * extra);
      publish();
    },
    [publish],
  );

  const rebase = useCallback(
    (force = false) => {
      const { width, height } = viewport.current;
      if (!width || !height) return;
      const surface = spatialNativeSurface(width, height);
      const scale = currentScale();
      const camera = cameraTopLeft();
      const origin = originRef.current;
      const visibleWidth = width / scale;
      const visibleHeight = height / scale;
      const worldWidth = surface.width / bakedScaleRef.current;
      const worldHeight = surface.height / bakedScaleRef.current;
      const worldOverscanX = surface.overscanX / bakedScaleRef.current;
      const worldOverscanY = surface.overscanY / bakedScaleRef.current;
      const nearEdge =
        camera.x < origin.x + worldOverscanX / 2 ||
        camera.y < origin.y + worldOverscanY / 2 ||
        camera.x + visibleWidth > origin.x + worldWidth - worldOverscanX / 2 ||
        camera.y + visibleHeight > origin.y + worldHeight - worldOverscanY / 2;
      const extraOutOfRange =
        transform.current.scale < 1 / MATERIAL_ZOOM || transform.current.scale > MATERIAL_ZOOM;
      if (!force && !nearEdge && !extraOutOfRange) return;

      const nextOrigin = {
        x: camera.x - surface.overscanX / scale,
        y: camera.y - surface.overscanY / scale,
      };
      const sameOrigin =
        Math.abs(nextOrigin.x - origin.x) < 0.01 && Math.abs(nextOrigin.y - origin.y) < 0.01;
      if (!force && sameOrigin && !extraOutOfRange) return;
      commitWindow(nextOrigin, scale, 1, {
        x: -(camera.x - nextOrigin.x) * scale,
        y: -(camera.y - nextOrigin.y) * scale,
      });
    },
    [cameraTopLeft, commitWindow, currentScale],
  );

  const zoomAround = useCallback(
    (nextScale: number, focus: SpatialPoint, publishScale = false) => {
      const previous = currentScale();
      const clamped = Math.max(minScale(), Math.min(maxScale, nextScale));
      if (clamped === previous) return;
      const previousExtra = transform.current.scale;
      const nextExtra = clamped / bakedScaleRef.current;
      transform.current.x = focus.x - ((focus.x - transform.current.x) * nextExtra) / previousExtra;
      transform.current.y = focus.y - ((focus.y - transform.current.y) * nextExtra) / previousExtra;
      transform.current.scale = nextExtra;
      if (publishScale) setScaleState(clamped);
      publish();
      if (nextExtra < 1 / MATERIAL_ZOOM || nextExtra > MATERIAL_ZOOM) rebase(true);
    },
    [currentScale, maxScale, minScale, publish, rebase],
  );

  const fitToScreen = useCallback(() => {
    const { width, height } = viewport.current;
    if (!width || !height) return;
    const bounds = boundsRef.current;
    const surface = spatialNativeSurface(width, height);
    const hasBounds = !!bounds && bounds.width > 0 && bounds.height > 0;
    const target = hasBounds
      ? Math.min(width / bounds.width, height / bounds.height) * FIT_MARGIN
      : 1;
    const scale = Math.max(minScale(), Math.min(maxScale, target));
    const camera = hasBounds
      ? {
          x: bounds.x + bounds.width / 2 - width / (2 * scale),
          y: bounds.y + bounds.height / 2 - height / (2 * scale),
        }
      : { x: -width / (2 * scale), y: -height / (2 * scale) };
    const origin = {
      x: camera.x - surface.overscanX / scale,
      y: camera.y - surface.overscanY / scale,
    };
    commitWindow(origin, scale, 1, {
      x: -surface.overscanX,
      y: -surface.overscanY,
    });
  }, [commitWindow, maxScale, minScale]);

  const viewportWorldCenter = useCallback((): SpatialPoint => {
    const { width, height } = viewport.current;
    const scale = currentScale();
    if (!width || !height || !scale) return { x: 0, y: 0 };
    const topLeft = cameraTopLeft();
    return { x: topLeft.x + width / (2 * scale), y: topLeft.y + height / (2 * scale) };
  }, [cameraTopLeft, currentScale]);

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen,
      zoomBy: (factor: number) => {
        zoomAround(
          currentScale() * factor,
          { x: viewport.current.width / 2, y: viewport.current.height / 2 },
          true,
        );
        rebase(true);
      },
      viewportWorldCenter,
    }),
    [currentScale, fitToScreen, rebase, viewportWorldCenter, zoomAround],
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
      const after = cameraTopLeft();
      autoPanHandler.current?.({ x: after.x - before.x, y: after.y - before.y });
      publish();
      rebase();
      state.frame = requestAnimationFrame((nextTimestamp) =>
        autoPanFrameRef.current?.(nextTimestamp),
      );
    },
    [cameraTopLeft, publish, rebase],
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
      if (wasEmpty) fitToScreen();
      else rebase(true);
    });
  }, [fitToScreen, rebase]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
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
            pinchScale: currentScale(),
          };
          tapping.current = (event.nativeEvent.touches?.length ?? 1) <= 1;
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
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
              gesture.current.pinchScale = currentScale();
            } else if (distance > 0) {
              zoomAround(
                (gesture.current.pinchScale * distance) / gesture.current.pinchDistance,
                focus,
              );
            }
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
          publish();
          rebase();
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event) => {
          const pointerId = (event.nativeEvent as { pointerId?: number }).pointerId;
          const target = event.currentTarget as unknown as {
            releasePointerCapture?: (id: number) => void;
          };
          if (pointerId != null) target?.releasePointerCapture?.(pointerId);
          if (gesture.current.pinchDistance) {
            setScaleState(currentScale());
            rebase(true);
          }
          gesture.current.pinchDistance = 0;
          tapping.current = false;
        },
        onPanResponderTerminate: () => {
          gesture.current.pinchDistance = 0;
          tapping.current = false;
        },
      }),
    [currentScale, publish, rebase, stopAutoPan, zoomAround],
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
    width: windowState.surfaceWidth,
    height: windowState.surfaceHeight,
    localOrigin: windowState.origin,
    bakedScale: windowState.bakedScale,
    renderWindow: windowState.renderWindow,
    scale: scaleState,
    setChildDragging: (dragging: boolean) => {
      childDragging.current = dragging;
      if (!dragging) stopAutoPan();
    },
    getTransform: () => ({
      scale: currentScale(),
      x: transform.current.x,
      y: transform.current.y,
    }),
    worldToScreen: (point: SpatialPoint): SpatialPoint =>
      spatialWorldToScreen(point, originRef.current, currentScale(), {
        x: transform.current.x,
        y: transform.current.y,
      }),
    viewportWorldCenter,
    updateAutoPan,
    stopAutoPan,
  };
}
