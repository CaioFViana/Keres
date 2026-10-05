import {
  canvasOverlayBounds,
  spatialRectIntersects,
  type CanvasOverlayType,
  type SketchDocument,
  type SketchItem,
  type SketchMatrix,
  type SketchPoint,
  type SpatialRect,
} from '@keres/shared';
import { Path, Rect } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import CanvasOverlayLayer from '@/src/components/features/graphs/CanvasOverlay/CanvasOverlayLayer';
import CanvasStampView from '@/src/components/features/graphs/CanvasOverlay/CanvasStampView';
import OverlayInteractionLayer from '@/src/components/features/graphs/CanvasOverlay/OverlayInteractionLayer';
import OverlaySelectionView from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectionView';
import type {
  OverlayCanvasCallbacks,
  OverlayInteractionMode,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import SkiaEdgeCanvas from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useEdgeFont } from '@/src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont';
import { type CanvasViewportHandle, useCanvasViewport } from '@/src/hooks/useCanvasViewport';
import type { SketchTool } from '@/src/state/sketchToolStore';
import { useTheme } from '@/src/theme';
import type { ErasePreview } from '@/src/hooks/useSketchDrawing';
import SketchInputLayer, {
  SKETCH_HANDLE_SCREEN,
  SKETCH_KNOB_SCREEN,
  type SketchBrushStyle,
} from './SketchInputLayer';
import SketchLayersView from './SketchLayersView';
import SketchPreviewView, { type SketchPreview } from './SketchPreviewView';

export type SketchCanvasHandle = CanvasViewportHandle;

/** Outside-page dim, so the paper reads as paper even on a dark canvas. */
const PAGE_DIM_COLOR = 'rgba(0,0,0,0.45)';
const CHECKER_CELL = 24;

function checkerPath(width: number, height: number): string {
  let d = '';
  for (let row = 0; row * CHECKER_CELL < height; row += 1) {
    for (let column = 0; column * CHECKER_CELL < width; column += 1) {
      if ((row + column) % 2 === 0) continue;
      const x = column * CHECKER_CELL;
      const y = row * CHECKER_CELL;
      const w = Math.min(CHECKER_CELL, width - x);
      const h = Math.min(CHECKER_CELL, height - y);
      d += `M${x} ${y}h${w}v${h}h${-w}Z`;
    }
  }
  return d;
}

interface SketchCanvasProps {
  doc: SketchDocument;
  tool: SketchTool;
  brushStyle: SketchBrushStyle;
  eraserSize: number;
  /** The selected drawing items and the layer they live on. */
  selection: { layerId: string; items: ReadonlySet<SketchItem>; bounds: SpatialRect } | null;
  /** Live transform of the selection while a handle is dragged; null at rest. */
  transformMatrix: SketchMatrix | null;
  /** Objects (text, balloons, stamps): the overlay actions hook's tool/selection state. */
  interactionMode: OverlayInteractionMode;
  selectedOverlayId: string | null;
  overlayCallbacks: OverlayCanvasCallbacks;
  onPlaceText: (point: SketchPoint) => void;
  onStrokeCommit: (points: number[]) => void;
  onErase: (path: number[], radius: number) => void;
  onEraseEnd: () => void;
  /** The eraser's path in progress, drawn as a live clear over the active layer's fills. */
  erasePreview: ErasePreview | null;
  onFillTap: (point: SketchPoint) => void;
  onPick: (point: SketchPoint) => void;
  onLassoCommit: (polygon: number[]) => void;
  onSelectTap: (point: SketchPoint, tolerance: number) => void;
  onTransformPreview: (matrix: SketchMatrix | null) => void;
  onTransformCommit: (matrix: SketchMatrix) => void;
  /** Reports the view rotation so the screen can show the reset control. */
  onRotationChange?: (radians: number) => void;
}

const DRAWING_TOOLS: ReadonlySet<SketchTool> = new Set([
  'brush',
  'eraser',
  'fill',
  'eyedropper',
  'select',
  'line',
  'rect',
  'ellipse',
]);

/**
 * The sketch drawing surface: layers of strokes and fills (replayed from items, never bitmaps)
 * and editable objects above them, over one page. The page bounds the export; the camera roams
 * (and twists) freely around it. One finger draws with the armed tool, two fingers navigate.
 */
const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>((props, ref) => {
  const {
    doc,
    tool,
    brushStyle,
    eraserSize,
    selection,
    transformMatrix,
    interactionMode,
    selectedOverlayId,
    overlayCallbacks,
    onPlaceText,
    onStrokeCommit,
    onErase,
    onEraseEnd,
    erasePreview,
    onFillTap,
    onPick,
    onLassoCommit,
    onSelectTap,
    onTransformPreview,
    onTransformCommit,
    onRotationChange,
  } = props;
  const { colors } = useTheme();
  const [preview, setPreview] = useState<SketchPreview | null>(null);
  const [rectPreview, setRectPreview] = useState<{ start: SketchPoint; end: SketchPoint } | null>(
    null,
  );

  const page = doc.page;
  const viewport = useCanvasViewport(
    ref,
    { x: 0, y: 0, width: page.width, height: page.height },
    { clampMode: 'none', rotationEnabled: true },
  );
  const {
    setChildDragging,
    width,
    height,
    cameraTransform,
    renderWindow,
    scale,
    screenToWorld,
    containerRef,
    handleLayout,
    panHandlers,
    animatedTransform,
  } = viewport;

  const objectToolArmed = interactionMode !== null;
  const drawingToolArmed =
    DRAWING_TOOLS.has(tool) && !objectToolArmed && selectedOverlayId === null;
  // An armed tool owns every one-finger gesture: the pan responder yields while the catcher above
  // the plane takes them (a second finger still reaches the pan responder, see the viewport).
  useEffect(() => {
    setChildDragging(objectToolArmed || drawingToolArmed);
  }, [drawingToolArmed, objectToolArmed, setChildDragging]);
  const rotation = viewport.rotation;
  useEffect(() => {
    onRotationChange?.(rotation);
  }, [onRotationChange, rotation]);

  const edgeFont = useEdgeFont(11, true);
  const overlays = doc.overlays;
  const visibleStamps = useMemo(
    () =>
      overlays
        .filter(
          (overlay): overlay is Extract<CanvasOverlayType, { kind: 'stamp' }> =>
            overlay.kind === 'stamp',
        )
        .filter((stamp) => spatialRectIntersects(canvasOverlayBounds(stamp), renderWindow))
        .map((stamp, order) => ({ stamp, order }))
        .sort(
          (left, right) =>
            (left.stamp.zIndex ?? 0) - (right.stamp.zIndex ?? 0) || left.order - right.order,
        )
        .map(({ stamp }) => stamp),
    [overlays, renderWindow],
  );
  const selectedOverlay = selectedOverlayId
    ? (overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null)
    : null;

  const paperColor =
    page.background === 'white'
      ? '#ffffff'
      : page.background === 'transparent'
        ? null
        : colors.surface;
  const checker = useMemo(
    () => (page.background === 'transparent' ? checkerPath(page.width, page.height) : ''),
    [page.background, page.height, page.width],
  );
  const liveTransform = useMemo(
    () =>
      selection && transformMatrix
        ? { layerId: selection.layerId, items: selection.items, matrix: transformMatrix }
        : null,
    [selection, transformMatrix],
  );
  const chrome = useMemo(
    () =>
      selection && tool === 'select'
        ? {
            bounds: selection.bounds,
            matrix: transformMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
          }
        : null,
    [selection, tool, transformMatrix],
  );

  const safeScale = scale === 0 ? 1 : scale;
  const overlay =
    width > 0 && height > 0 ? (
      <SkiaOverlayErrorBoundary canvas="board">
        <SkiaEdgeCanvas camera={cameraTransform}>
          <Rect
            x={renderWindow.x}
            y={renderWindow.y}
            width={renderWindow.width}
            height={renderWindow.height}
            color={PAGE_DIM_COLOR}
          />
          <Rect
            x={0}
            y={0}
            width={page.width}
            height={page.height}
            color={paperColor ?? '#ffffff'}
          />
          {checker !== '' && <Path path={checker} color="rgba(0,0,0,0.08)" />}
          <SketchLayersView layers={doc.layers} transform={liveTransform} erase={erasePreview} />
          <Rect
            x={0}
            y={0}
            width={page.width}
            height={page.height}
            color={colors.border}
            style="stroke"
            strokeWidth={2 / safeScale}
          />
          <CanvasOverlayLayer
            overlays={overlays}
            renderWindow={renderWindow}
            stroke={colors.text}
            labelBackground={colors.surface}
            font={edgeFont}
          />
          <SketchPreviewView
            preview={preview}
            selection={chrome}
            scale={scale}
            color={colors.primary}
            handleSize={SKETCH_HANDLE_SCREEN * 0.5}
            knobDistance={SKETCH_KNOB_SCREEN}
          />
          {rectPreview && (
            <Rect
              x={Math.min(rectPreview.start.x, rectPreview.end.x)}
              y={Math.min(rectPreview.start.y, rectPreview.end.y)}
              width={Math.abs(rectPreview.end.x - rectPreview.start.x)}
              height={Math.abs(rectPreview.end.y - rectPreview.start.y)}
              style="stroke"
              strokeWidth={2 / safeScale}
              color={colors.primary}
            />
          )}
        </SkiaEdgeCanvas>
      </SkiaOverlayErrorBoundary>
    ) : null;

  let interactionOverlay = null;
  if (objectToolArmed && interactionMode) {
    interactionOverlay = (
      <OverlayInteractionLayer
        mode={interactionMode}
        screenToWorld={screenToWorld}
        scale={scale}
        overlays={overlays}
        snapTargets={[]}
        onDrawTap={(point) => {
          if (interactionMode.kind === 'draw' && interactionMode.tool === 'text') {
            onPlaceText(point);
            return;
          }
          overlayCallbacks.onDrawTap(point);
        }}
        onStampPlace={overlayCallbacks.onStampPlace}
        onDrawRect={(start, end) => {
          if (interactionMode.kind === 'draw') {
            overlayCallbacks.onDrawRect(interactionMode.tool, start, end);
          }
        }}
        onPreviewRect={setRectPreview}
        onSelectOverlay={overlayCallbacks.onSelectOverlay}
      />
    );
  } else if (drawingToolArmed) {
    interactionOverlay = (
      <SketchInputLayer
        tool={tool as Parameters<typeof SketchInputLayer>[0]['tool']}
        screenToWorld={screenToWorld}
        scale={scale}
        brushStyle={brushStyle}
        eraserSize={eraserSize}
        selectionBounds={selection?.bounds ?? null}
        onPreview={setPreview}
        onStrokeCommit={onStrokeCommit}
        onErase={onErase}
        onEraseEnd={onEraseEnd}
        onFillTap={onFillTap}
        onPick={onPick}
        onLassoCommit={onLassoCommit}
        onSelectTap={onSelectTap}
        onTransformPreview={onTransformPreview}
        onTransformCommit={onTransformCommit}
      />
    );
  }

  return (
    <GraphCanvasFrame
      containerRef={containerRef}
      handleLayout={handleLayout}
      panHandlers={panHandlers}
      animatedTransform={animatedTransform}
      overlay={overlay}
      interactionOverlay={interactionOverlay}
    >
      {visibleStamps.map((stamp) => (
        <CanvasStampView key={stamp.id} stamp={stamp} />
      ))}
      {selectedOverlay && (
        <OverlaySelectionView
          overlay={selectedOverlay}
          scale={scale}
          onDragStart={() => setChildDragging(true)}
          onDragEnd={() => setChildDragging(false)}
          onCommitMove={overlayCallbacks.onCommitMove}
          onCommitVertex={overlayCallbacks.onCommitVertex}
          onCommitRect={overlayCallbacks.onCommitRect}
          onCommitTail={overlayCallbacks.onCommitTail}
          onDetails={overlayCallbacks.onOpenOverlaySheet}
          onMoveLayer={overlayCallbacks.onMoveOverlayLayer}
          onToggleLock={overlayCallbacks.onToggleLock}
          onDeselect={overlayCallbacks.onDeselectOverlay}
        />
      )}
    </GraphCanvasFrame>
  );
});

SketchCanvas.displayName = 'SketchCanvas';

export default SketchCanvas;
