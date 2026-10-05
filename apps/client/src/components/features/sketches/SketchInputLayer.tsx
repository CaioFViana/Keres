import {
  hitSelectionHandle,
  selectionDragMatrix,
  sketchShapePoints,
  type SelectionHandle,
  type SketchBrushId,
  type SketchMatrix,
  type SketchPoint,
  type SpatialRect,
} from '@keres/shared';
import React, { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { SketchTool } from '../../../state/sketchToolStore';
import type { SketchPreview } from './SketchPreviewView';

export interface SketchBrushStyle {
  brush: SketchBrushId;
  color: string;
  alpha: number;
  size: number;
}

interface SketchInputLayerProps {
  tool: Exclude<SketchTool, 'hand' | 'text' | 'balloon' | 'stamp'>;
  screenToWorld: (point: SketchPoint) => SketchPoint;
  scale: number;
  brushStyle: SketchBrushStyle;
  eraserSize: number;
  /** Bounds of the current selection (select tool); null when nothing is selected. */
  selectionBounds: SpatialRect | null;
  onPreview: (preview: SketchPreview | null) => void;
  onStrokeCommit: (points: number[]) => void;
  onErase: (path: number[], radius: number) => void;
  onEraseEnd: () => void;
  onFillTap: (point: SketchPoint) => void;
  onPick: (point: SketchPoint) => void;
  onLassoCommit: (polygon: number[]) => void;
  /** `tolerance` is the hit radius in world units (a fixed screen distance at this zoom). */
  onSelectTap: (point: SketchPoint, tolerance: number) => void;
  onTransformPreview: (matrix: SketchMatrix | null) => void;
  onTransformCommit: (matrix: SketchMatrix) => void;
}

/** A press that barely moves is a tap. In screen pixels. */
const TAP_SLOP = 6;
const HANDLE_SCREEN = 20;
const KNOB_SCREEN = 34;
const SELECT_HIT_SCREEN = 12;
/** Collected stroke points are at least this far apart on screen. */
const POINT_SPACING_SCREEN = 1.2;
const MIN_POINT_SPACING_WORLD = 0.3;

type Mode =
  | { kind: 'idle' }
  | { kind: 'stroke'; points: number[] }
  | { kind: 'shape'; start: SketchPoint }
  | { kind: 'erase'; path: number[] }
  | { kind: 'lasso'; points: number[] }
  | { kind: 'handle'; handle: SelectionHandle; start: SketchPoint }
  | { kind: 'tap' };

/** Screen-space size of the selection knob offset, shared with the preview. */
export const SKETCH_HANDLE_SCREEN = HANDLE_SCREEN;
export const SKETCH_KNOB_SCREEN = KNOB_SCREEN;

/**
 * The single-finger touch catcher of the drawing tools, mounted above the plane while a drawing
 * tool is armed. One finger draws; a second finger makes the canvas's own responder take over
 * (pan/zoom/twist), and this layer abandons the stroke it had started. Everything reads through
 * a ref so a re-render mid-gesture never replaces the responder (react-native-web recomputes
 * dx/dy from a fresh accumulator otherwise).
 */
const SketchInputLayer: React.FC<SketchInputLayerProps> = (props) => {
  const live = useRef(props);
  useEffect(() => {
    // Latest-props sync: every reader runs on gestures, after effects have flushed.
    live.current = props;
  });
  const startScreen = useRef({ x: 0, y: 0 });
  const mode = useRef<Mode>({ kind: 'idle' });
  const moved = useRef(false);

  const responder = useMemo(() => {
    const worldAt = (screenX: number, screenY: number) =>
      live.current.screenToWorld({ x: screenX, y: screenY });
    const currentWorld = (gesture: { dx: number; dy: number }) =>
      worldAt(startScreen.current.x + gesture.dx, startScreen.current.y + gesture.dy);
    const spacing = () =>
      Math.max(MIN_POINT_SPACING_WORLD, POINT_SPACING_SCREEN / (live.current.scale || 1));
    const eraserRadius = () => live.current.eraserSize / 2;

    const finishEraser = () => {
      live.current.onPreview(null);
      live.current.onEraseEnd();
    };

    // eslint-disable-next-line react-hooks/refs -- handlers touch refs only on gestures; create wires them without invoking any during render.
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const props = live.current;
        startScreen.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        moved.current = false;
        const start = worldAt(startScreen.current.x, startScreen.current.y);
        switch (props.tool) {
          case 'brush': {
            mode.current = { kind: 'stroke', points: [start.x, start.y] };
            props.onPreview({
              kind: 'stroke',
              stroke: { kind: 'stroke', ...props.brushStyle, points: [start.x, start.y] },
            });
            break;
          }
          case 'line':
          case 'rect':
          case 'ellipse':
            mode.current = { kind: 'shape', start };
            break;
          case 'eraser': {
            mode.current = { kind: 'erase', path: [start.x, start.y] };
            props.onErase([start.x, start.y], eraserRadius());
            props.onPreview({ kind: 'eraser', x: start.x, y: start.y, radius: eraserRadius() });
            break;
          }
          case 'select': {
            const bounds = props.selectionBounds;
            const radius = HANDLE_SCREEN / (props.scale || 1);
            const handle = bounds
              ? hitSelectionHandle(bounds, start, radius, KNOB_SCREEN / (props.scale || 1))
              : null;
            mode.current = handle
              ? { kind: 'handle', handle, start }
              : { kind: 'lasso', points: [start.x, start.y] };
            break;
          }
          default:
            mode.current = { kind: 'tap' };
        }
      },
      onPanResponderMove: (_, gesture) => {
        const props = live.current;
        const current = mode.current;
        if (!moved.current && Math.hypot(gesture.dx, gesture.dy) < TAP_SLOP) return;
        moved.current = true;
        const world = currentWorld(gesture);
        switch (current.kind) {
          case 'stroke': {
            const { points } = current;
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            if (Math.hypot(world.x - lastX, world.y - lastY) < spacing()) return;
            points.push(world.x, world.y);
            props.onPreview({
              kind: 'stroke',
              stroke: { kind: 'stroke', ...props.brushStyle, points: [...points] },
            });
            break;
          }
          case 'shape': {
            if (props.tool !== 'line' && props.tool !== 'rect' && props.tool !== 'ellipse') return;
            props.onPreview({
              kind: 'stroke',
              stroke: {
                kind: 'stroke',
                ...props.brushStyle,
                points: sketchShapePoints(props.tool, current.start, world),
              },
            });
            break;
          }
          case 'erase': {
            const path = current.path;
            const lastX = path[path.length - 2];
            const lastY = path[path.length - 1];
            if (Math.hypot(world.x - lastX, world.y - lastY) < spacing()) {
              props.onPreview({ kind: 'eraser', x: world.x, y: world.y, radius: eraserRadius() });
              return;
            }
            props.onErase([lastX, lastY, world.x, world.y], eraserRadius());
            path.push(world.x, world.y);
            props.onPreview({ kind: 'eraser', x: world.x, y: world.y, radius: eraserRadius() });
            break;
          }
          case 'lasso': {
            const { points } = current;
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            if (Math.hypot(world.x - lastX, world.y - lastY) < spacing() * 2) return;
            points.push(world.x, world.y);
            props.onPreview({ kind: 'lasso', points: [...points] });
            break;
          }
          case 'handle': {
            const bounds = props.selectionBounds;
            if (!bounds) return;
            props.onTransformPreview(
              selectionDragMatrix(current.handle, bounds, current.start, world),
            );
            break;
          }
          default:
            break;
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const props = live.current;
        const current = mode.current;
        mode.current = { kind: 'idle' };
        const world = currentWorld(gesture);
        const wasTap = !moved.current;
        props.onPreview(null);
        switch (current.kind) {
          case 'stroke': {
            // A tap is a dot: the brush's own size at that spot.
            props.onStrokeCommit(
              wasTap
                ? [current.points[0], current.points[1]]
                : [...current.points, world.x, world.y],
            );
            break;
          }
          case 'shape': {
            if (wasTap) break;
            if (props.tool !== 'line' && props.tool !== 'rect' && props.tool !== 'ellipse') break;
            props.onStrokeCommit(sketchShapePoints(props.tool, current.start, world));
            break;
          }
          case 'erase': {
            // A tap erases a disc where it landed (the grant already did); the end cuts the fills.
            finishEraser();
            break;
          }
          case 'lasso': {
            if (wasTap) props.onSelectTap(world, SELECT_HIT_SCREEN / (props.scale || 1));
            else props.onLassoCommit(current.points);
            break;
          }
          case 'handle': {
            const bounds = props.selectionBounds;
            props.onTransformPreview(null);
            if (wasTap) {
              // A tap on the body with no drag selects whatever is under it instead.
              props.onSelectTap(world, SELECT_HIT_SCREEN / (props.scale || 1));
            } else if (bounds) {
              props.onTransformCommit(
                selectionDragMatrix(current.handle, bounds, current.start, world),
              );
            }
            break;
          }
          case 'tap': {
            if (props.tool === 'fill') props.onFillTap(world);
            else if (props.tool === 'eyedropper') props.onPick(world);
            break;
          }
          default:
            break;
        }
      },
      onPanResponderTerminate: () => {
        const props = live.current;
        const current = mode.current;
        mode.current = { kind: 'idle' };
        props.onPreview(null);
        props.onTransformPreview(null);
        // A second finger means the user is navigating: an erase already applied stays (it was
        // committed stroke by stroke), but an unfinished stroke, shape or lasso is dropped.
        if (current.kind === 'erase') props.onEraseEnd();
      },
    });
    // Created once; see the `live` ref above.
  }, []);

  return (
    <View
      testID="sketch-input-layer"
      style={[
        StyleSheet.absoluteFill,
        Platform.OS === 'web'
          ? ({ cursor: 'crosshair', touchAction: 'none' } as Record<string, string>)
          : {},
      ]}
      {...responder.panHandlers}
    />
  );
};

export default SketchInputLayer;
