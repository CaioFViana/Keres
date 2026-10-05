import type { CanvasOverlayType, SpatialPoint } from '@keres/shared';
import {
  hitTestCanvasOverlay,
  snapPointToTargets,
} from '@keres/shared/graphs/canvasOverlayGeometry';
import React, { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { OverlayDrawTool } from './overlayTools';
import { isRectDrawTool } from './overlayTools';

export type OverlayCatcherMode = { kind: 'draw'; tool: OverlayDrawTool } | { kind: 'select' };

interface OverlayInteractionLayerProps {
  mode: OverlayCatcherMode;
  screenToWorld: (point: SpatialPoint) => SpatialPoint;
  scale: number;
  overlays: readonly CanvasOverlayType[] | undefined;
  snapTargets: readonly SpatialPoint[];
  onDrawTap: (point: SpatialPoint) => void;
  onStampPlace: (point: SpatialPoint) => void;
  onDrawRect: (start: SpatialPoint, end: SpatialPoint) => void;
  onPreviewRect: (rect: { start: SpatialPoint; end: SpatialPoint } | null) => void;
  onSelectOverlay: (id: string | null) => void;
}

/** A press that barely moves is a tap; anything else is a rect drag. In screen pixels. */
const TAP_SLOP = 8;
/** Snap and hit radii, in screen pixels so they feel the same at any zoom. */
const SNAP_SCREEN = 14;
const HIT_SCREEN = 10;

/**
 * Full-canvas touch catcher, mounted above the plane only while a draw tool or the select
 * tool is armed (canvases also hold `setChildDragging`, so the pan responder yields).
 * Taps place vertices or hit-test overlays; drags draw rects with a live preview.
 */
const OverlayInteractionLayer: React.FC<OverlayInteractionLayerProps> = ({
  mode,
  screenToWorld,
  scale,
  overlays,
  snapTargets,
  onDrawTap,
  onStampPlace,
  onDrawRect,
  onPreviewRect,
  onSelectOverlay,
}) => {
  const startScreen = useRef({ x: 0, y: 0 });
  const startWorld = useRef<SpatialPoint>({ x: 0, y: 0 });
  const callbacks = useRef({
    screenToWorld,
    onDrawTap,
    onStampPlace,
    onDrawRect,
    onPreviewRect,
    onSelectOverlay,
  });
  const live = useRef({ mode, overlays, scale, snapTargets });
  useEffect(() => {
    // Latest-ref sync for the responder below: every reader runs on gestures, after effects
    // have flushed. No dependency array - the sync unconditionally followed every render.
    live.current = { mode, overlays, scale, snapTargets };
    callbacks.current = {
      screenToWorld,
      onDrawTap,
      onStampPlace,
      onDrawRect,
      onPreviewRect,
      onSelectOverlay,
    };
    // The responder below is created once (see its empty dependency array): values it
    // reads live behind the `live` ref instead, so a re-render mid-gesture never resets
    // the accumulated gestureState. Recreating it per render pins web drags near the
    // press point, because react-native-web recomputes dx/dy from a fresh accumulator
    // on each new responder config.
  });

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- handlers touch refs only on gestures; create wires them without invoking any during render.
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const at = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          startScreen.current = at;
          startWorld.current = callbacks.current.screenToWorld(at);
        },
        onPanResponderMove: (event, gesture) => {
          if (live.current.mode.kind !== 'draw') return;
          if (!isRectDrawTool(live.current.mode.tool)) return;
          const at = {
            x: startScreen.current.x + gesture.dx,
            y: startScreen.current.y + gesture.dy,
          };
          callbacks.current.onPreviewRect({
            start: startWorld.current,
            end: callbacks.current.screenToWorld(at),
          });
        },
        onPanResponderRelease: (event, gesture) => {
          const moved = Math.hypot(gesture.dx, gesture.dy);
          const safeScale = live.current.scale === 0 ? 1 : live.current.scale;
          if (moved < TAP_SLOP) {
            callbacks.current.onPreviewRect(null);
            const world = callbacks.current.screenToWorld({
              x: event.nativeEvent.locationX,
              y: event.nativeEvent.locationY,
            });
            if (live.current.mode.kind === 'select') {
              const hit = hitTestCanvasOverlay(
                world,
                live.current.overlays ?? [],
                HIT_SCREEN / safeScale,
              );
              callbacks.current.onSelectOverlay(hit?.id ?? null);
              return;
            }
            if (live.current.mode.tool === 'stamp') {
              callbacks.current.onStampPlace(world);
              return;
            }
            if (!isRectDrawTool(live.current.mode.tool)) {
              callbacks.current.onDrawTap(
                snapPointToTargets(world, live.current.snapTargets, SNAP_SCREEN / safeScale),
              );
            }
            return;
          }
          if (live.current.mode.kind === 'draw' && isRectDrawTool(live.current.mode.tool)) {
            const end = callbacks.current.screenToWorld({
              x: startScreen.current.x + gesture.dx,
              y: startScreen.current.y + gesture.dy,
            });
            callbacks.current.onPreviewRect(null);
            callbacks.current.onDrawRect(startWorld.current, end);
            return;
          }
          callbacks.current.onPreviewRect(null);
        },
        onPanResponderTerminate: () => callbacks.current.onPreviewRect(null),
      }),
    // Created once: every value above is read through refs, so preview setStates (one per
    // mousemove) never swap the responder mid-gesture. See the `live` ref above.
    [],
  );

  return (
    <View
      testID="overlay-interaction-layer"
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web' ? ({ cursor: 'crosshair' } as Record<string, string>) : {},
      ]}
      {...responder.panHandlers}
    />
  );
};

export default OverlayInteractionLayer;
