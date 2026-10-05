import {
  canvasOverlayBounds,
  spatialRectIntersects,
  type CanvasOverlayType,
  type SketchContentType,
  type SketchLayerType,
  type SpatialPoint,
} from '@keres/shared';
import { Rect } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import CanvasOverlayLayer from '@/src/components/features/graphs/CanvasOverlay/CanvasOverlayLayer';
import CanvasStampView from '@/src/components/features/graphs/CanvasOverlay/CanvasStampView';
import OverlayDraftView from '@/src/components/features/graphs/CanvasOverlay/OverlayDraftView';
import OverlayInteractionLayer from '@/src/components/features/graphs/CanvasOverlay/OverlayInteractionLayer';
import OverlaySelectionView from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectionView';
import type {
  OverlayCanvasCallbacks,
  OverlayDraft,
  OverlayDrawTool,
  OverlayInteractionMode,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import SkiaEdgeCanvas from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { useEdgeFont } from '@/src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont';
import { type CanvasViewportHandle, useCanvasViewport } from '@/src/hooks/useCanvasViewport';
import { useTheme } from '@/src/theme';

export type SketchCanvasHandle = CanvasViewportHandle;

interface SketchCanvasProps {
  content: SketchContentType;
  interactionMode: OverlayInteractionMode;
  draft: OverlayDraft | null;
  drawTool: OverlayDrawTool | null;
  selectedOverlayId: string | null;
  overlayCallbacks: OverlayCanvasCallbacks;
  onFreehandCommit: (points: SpatialPoint[]) => void;
  onPlaceText: (point: SpatialPoint) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onExport: () => void;
  /** Reports the view rotation so the screen can show the reset control. */
  onRotationChange?: (radians: number) => void;
}

/** Outside-page dim, so the paper reads as paper even on a dark canvas. */
const PAGE_DIM_COLOR = 'rgba(0,0,0,0.45)';

function layerById(layers: readonly SketchLayerType[]): Map<string, SketchLayerType> {
  return new Map(layers.map((layer) => [layer.id, layer]));
}

/**
 * The sketch drawing surface: vector overlays over one page, no pins, no edges. The page
 * bounds the export; the camera roams (and twists) freely around it.
 */
const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(
  (
    {
      content,
      interactionMode,
      draft,
      drawTool,
      selectedOverlayId,
      overlayCallbacks,
      onFreehandCommit,
      onPlaceText,
      onZoomIn,
      onZoomOut,
      onFit,
      onExport,
      onRotationChange,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [rectPreview, setRectPreview] = useState<{
      start: SpatialPoint;
      end: SpatialPoint;
    } | null>(null);
    const [freehandPreview, setFreehandPreview] = useState<SpatialPoint[] | null>(null);

    const page = content.page;
    const layers = useMemo(() => layerById(content.layers), [content.layers]);
    const isOverlayHidden = useMemo(
      () => (overlay: CanvasOverlayType) => {
        if (overlay.layerId === undefined) return false;
        return layers.get(overlay.layerId)?.visible === false;
      },
      [layers],
    );
    const overlayOpacity = useMemo(
      () => (overlay: CanvasOverlayType) => {
        if (overlay.layerId === undefined) return 1;
        return layers.get(overlay.layerId)?.opacity ?? 1;
      },
      [layers],
    );

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
    // An armed overlay tool owns every gesture until it is done: the pan responder yields
    // while the interaction catcher above the plane takes the taps and drags.
    useEffect(() => {
      setChildDragging(!!interactionMode);
    }, [interactionMode, setChildDragging]);
    const rotation = viewport.rotation;
    useEffect(() => {
      onRotationChange?.(rotation);
    }, [onRotationChange, rotation]);

    const edgeFont = useEdgeFont(11, true);

    const visibleOverlays = useMemo(
      () => (content.overlays ?? []).filter((overlay) => !isOverlayHidden(overlay)),
      [content.overlays, isOverlayHidden],
    );
    const visibleStamps = useMemo(
      () =>
        visibleOverlays
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
      [visibleOverlays, renderWindow],
    );
    const selectedOverlay = selectedOverlayId
      ? (visibleOverlays.find((overlay) => overlay.id === selectedOverlayId) ?? null)
      : null;

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
            <Rect x={0} y={0} width={page.width} height={page.height} color={colors.surface} />
            <Rect
              x={0}
              y={0}
              width={page.width}
              height={page.height}
              color={colors.border}
              style="stroke"
              strokeWidth={2 / (scale === 0 ? 1 : scale)}
            />
            <CanvasOverlayLayer
              overlays={content.overlays}
              renderWindow={renderWindow}
              stroke={colors.text}
              labelBackground={colors.surface}
              font={edgeFont}
              isOverlayHidden={isOverlayHidden}
              overlayOpacity={overlayOpacity}
            />
            <OverlayDraftView
              points={freehandPreview ?? draft?.points ?? null}
              rect={rectPreview}
              color={colors.primary}
              scale={scale}
              dots={freehandPreview === null}
            />
          </SkiaEdgeCanvas>
        </SkiaOverlayErrorBoundary>
      ) : null;

    return (
      <GraphCanvasFrame
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
        overlay={overlay}
        interactionOverlay={
          interactionMode ? (
            <OverlayInteractionLayer
              mode={interactionMode}
              screenToWorld={screenToWorld}
              scale={scale}
              overlays={visibleOverlays}
              snapTargets={[]}
              onDrawTap={(point) => {
                // Text places on tap; freehand commits on drag release (taps are ignored:
                // a dot is a stamp's job). Everything else taps vertices.
                if (drawTool === 'text') {
                  onPlaceText(point);
                  return;
                }
                if (drawTool === 'freehand') return;
                overlayCallbacks.onDrawTap(point);
              }}
              onStampPlace={overlayCallbacks.onStampPlace}
              onDrawRect={(start, end) => {
                if (interactionMode.kind === 'draw')
                  overlayCallbacks.onDrawRect(interactionMode.tool, start, end);
              }}
              onPreviewRect={setRectPreview}
              onPreviewFreehand={setFreehandPreview}
              onFreehandCommit={onFreehandCommit}
              onSelectOverlay={overlayCallbacks.onSelectOverlay}
            />
          ) : null
        }
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
            onDetails={overlayCallbacks.onOpenOverlaySheet}
            onMoveLayer={overlayCallbacks.onMoveOverlayLayer}
            onToggleLock={overlayCallbacks.onToggleLock}
            onDeselect={overlayCallbacks.onDeselectOverlay}
          />
        )}
        <GraphCanvasControls
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFit={onFit}
          onExport={onExport}
        />
      </GraphCanvasFrame>
    );
  },
);

SketchCanvas.displayName = 'SketchCanvas';

export default SketchCanvas;
