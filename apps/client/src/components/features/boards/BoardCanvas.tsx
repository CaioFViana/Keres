import {
  canvasOverlayBounds,
  clipSpatialSegment,
  spatialRectIntersects,
  type BoardContentType,
  type BoardNodeType,
  type CanvasOverlayType,
} from '@keres/shared';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashPathEffect, Path, Text as SkiaText } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import CanvasOverlayLayer from '@/src/components/features/graphs/CanvasOverlay/CanvasOverlayLayer';
import CanvasStampView from '@/src/components/features/graphs/CanvasOverlay/CanvasStampView';
import OverlayDraftView from '@/src/components/features/graphs/CanvasOverlay/OverlayDraftView';
import OverlayInteractionLayer from '@/src/components/features/graphs/CanvasOverlay/OverlayInteractionLayer';
import OverlaySelectionView from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectionView';
import type {
  OverlayCanvasCallbacks,
  OverlayDraft,
  OverlayInteractionMode,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import SkiaEdgeCanvas from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaEdgeCanvas';
import SkiaOverlayErrorBoundary from '@/src/components/features/graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import { polygonPointsToPath } from '@/src/components/features/graphs/SkiaEdgeCanvas/polygonPointsToPath';
import { measureEdgeLabelWidth } from '@/src/components/features/graphs/SkiaEdgeCanvas/measureEdgeLabelWidth';
import { useEdgeFont } from '@/src/components/features/graphs/SkiaEdgeCanvas/useEdgeFont';
import { type CanvasViewportHandle, useCanvasViewport } from '@/src/hooks/useCanvasViewport';
import { useTheme } from '../../../theme';
import { boardEdgeGeometry } from '../../../utils/boardEdges';
import { clampCanvasWorldCoordinate } from '../../../utils/canvasDragBounds';
import {
  boardCanvasBounds,
  boardNodeSize,
  type BoardGalleryMediaById,
} from '../../../utils/boardLayout';
import type { BoardEntitySummary } from '../../../utils/boardEntitySummary';
import type { BoardCardAppearance } from '../../../utils/boardPinAppearance';
import BoardNodeView from './BoardNode';

export type BoardCanvasHandle = CanvasViewportHandle;

export interface BoardPinTitle {
  title: string;
  typeLabel: string;
  appearanceType?: string;
  appearance?: BoardCardAppearance;
  ghost?: boolean;
}

interface Props {
  content: BoardContentType;
  titles: Record<string, BoardPinTitle>;
  selectedNodeId: string | null;
  layoutEditing: boolean;
  connectionMode: boolean;
  /** While set, pins ignore taps and drags: only overlay shapes respond. */
  overlayEditing: boolean;
  galleryMediaById?: BoardGalleryMediaById;
  summaries?: Record<string, BoardEntitySummary | null>;
  onSelectNode: (node: BoardNodeType) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onResizeNode: (nodeId: string, width: number, height: number) => void;
  onOpenNodeDetails: (node: BoardNodeType) => void;
  onBringNodeToFront: (nodeId: string) => void;
  onSendNodeToBack: (nodeId: string) => void;
  onConnectNodes: (fromNodeId: string, toNodeId: string) => void;
  interactionMode: OverlayInteractionMode;
  draft: OverlayDraft | null;
  selectedOverlayId: string | null;
  overlayCallbacks: OverlayCanvasCallbacks;
}

type ActiveDrag = { id: string; x: number; y: number };
type ConnectionDrag = { fromNodeId: string; x: number; y: number };
type BoardEdgeGeometry = ReturnType<typeof boardEdgeGeometry>;

const BoardEdgeView = React.memo(function BoardEdgeView({
  edge,
  stroke,
  labelBackground,
  font,
}: {
  edge: BoardEdgeGeometry;
  stroke: string;
  labelBackground: string;
  font: SkFont | null;
}) {
  // Skia has no `textAnchor`: center by measured width instead. Both place the baseline at
  // the same y. Without a font (web: `matchFamilyStyle` is unimplemented) the edge still
  // draws, only its label is skipped.
  const labelX =
    edge.label && font ? edge.labelX - measureEdgeLabelWidth(font, edge.label, 11) / 2 : 0;
  return (
    <>
      <Path path={edge.path} style="stroke" color={stroke} strokeWidth={edge.directed ? 2 : 1.6} />
      {edge.directed && <Path path={polygonPointsToPath(edge.arrow.points)} color={stroke} />}
      {!!edge.label && font && (
        <>
          <SkiaText
            x={labelX}
            y={edge.labelY}
            font={font}
            text={edge.label}
            color={labelBackground}
            style="stroke"
            strokeWidth={4}
          />
          <SkiaText x={labelX} y={edge.labelY} font={font} text={edge.label} color={stroke} />
        </>
      )}
    </>
  );
});

const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(
  (
    {
      content,
      titles,
      selectedNodeId,
      layoutEditing,
      connectionMode,
      overlayEditing,
      galleryMediaById,
      summaries,
      onSelectNode,
      onMoveNode,
      onResizeNode,
      onOpenNodeDetails,
      onBringNodeToFront,
      onSendNodeToBack,
      onConnectNodes,
      interactionMode,
      draft,
      selectedOverlayId,
      overlayCallbacks,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
    const [rectPreview, setRectPreview] = useState<{
      start: { x: number; y: number };
      end: { x: number; y: number };
    } | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const pendingDragRef = useRef<ActiveDrag | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const dragAutoPanOffsetRef = useRef({ x: 0, y: 0 });
    const edgeCacheRef = useRef(new Map<string, BoardEdgeGeometry>());

    const publishPendingDrag = useCallback(() => {
      dragFrameRef.current = null;
      const next = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!next) return;
      activeDragRef.current = next;
      setActiveDrag(next);
    }, []);
    const scheduleDrag = useCallback(() => {
      if (dragFrameRef.current === null)
        dragFrameRef.current = requestAnimationFrame(publishPendingDrag);
    }, [publishPendingDrag]);
    const adjustDraggedNodeForAutoPan = useCallback(
      (delta: { x: number; y: number }) => {
        const current = pendingDragRef.current ?? activeDragRef.current;
        if (!current) return;
        dragAutoPanOffsetRef.current = {
          x: dragAutoPanOffsetRef.current.x + delta.x,
          y: dragAutoPanOffsetRef.current.y + delta.y,
        };
        pendingDragRef.current = { ...current, x: current.x + delta.x, y: current.y + delta.y };
        scheduleDrag();
      },
      [scheduleDrag],
    );
    const layoutNodes = useMemo(
      () =>
        activeDrag
          ? content.nodes.map((node) =>
              node.id === activeDrag.id ? { ...node, x: activeDrag.x, y: activeDrag.y } : node,
            )
          : content.nodes,
      [activeDrag, content.nodes],
    );
    const worldBounds = boardCanvasBounds(layoutNodes, undefined, undefined, galleryMediaById);
    const viewport = useCanvasViewport(
      ref,
      {
        x: worldBounds.originX,
        y: worldBounds.originY,
        width: worldBounds.width,
        height: worldBounds.height,
      },
      { clampMode: 'none', onAutoPan: adjustDraggedNodeForAutoPan },
    );
    // System font on native, bundled Roboto on web; null while unavailable, where the
    // label below is skipped.
    const edgeFont = useEdgeFont(11, true);
    const {
      setChildDragging,
      width,
      height,
      cameraTransform,
      renderWindow,
      scale,
      worldToScreen,
      screenToWorld,
      updateAutoPan,
      stopAutoPan,
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

    const nodeCenter = useCallback(
      (node: BoardNodeType) => {
        const size = boardNodeSize(
          node,
          node.kind === 'entity' ? galleryMediaById?.[node.entityId] : undefined,
        );
        return { x: node.x + size.width / 2, y: node.y + size.height / 2 };
      },
      [galleryMediaById],
    );
    const handleNodeDragMove = useCallback(
      (nodeId: string, x: number, y: number) => {
        const node = content.nodes.find((candidate) => candidate.id === nodeId);
        if (!node) return;
        const position = {
          x: clampCanvasWorldCoordinate(x + dragAutoPanOffsetRef.current.x),
          y: clampCanvasWorldCoordinate(y + dragAutoPanOffsetRef.current.y),
        };
        pendingDragRef.current = { id: nodeId, ...position };
        const size = boardNodeSize(
          node,
          node.kind === 'entity' ? galleryMediaById?.[node.entityId] : undefined,
        );
        updateAutoPan(
          worldToScreen({ x: position.x + size.width / 2, y: position.y + size.height / 2 }),
        );
        scheduleDrag();
      },
      [content.nodes, galleryMediaById, scheduleDrag, updateAutoPan, worldToScreen],
    );
    const consumeNodeDrag = useCallback((nodeId: string) => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      const next = pendingDragRef.current ?? activeDragRef.current;
      pendingDragRef.current = null;
      activeDragRef.current = null;
      setActiveDrag(null);
      return next?.id === nodeId ? next : null;
    }, []);
    useEffect(
      () => () => {
        if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      },
      [],
    );
    const handleNodeDragStart = useCallback(() => {
      dragAutoPanOffsetRef.current = { x: 0, y: 0 };
      setChildDragging(true);
    }, [setChildDragging]);
    const handleNodeDragEnd = useCallback(
      (nodeId: string) => {
        stopAutoPan();
        setChildDragging(false);
        const position = consumeNodeDrag(nodeId);
        if (position) onMoveNode(nodeId, position.x, position.y);
      },
      [consumeNodeDrag, onMoveNode, setChildDragging, stopAutoPan],
    );
    const handleConnectionStart = useCallback(
      (node: BoardNodeType) => setConnectionDrag({ fromNodeId: node.id, ...nodeCenter(node) }),
      [nodeCenter],
    );
    const handleConnectionMove = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const node = layoutNodes.find((candidate) => candidate.id === nodeId);
        if (node) {
          const center = nodeCenter(node);
          setConnectionDrag({ fromNodeId: nodeId, x: center.x + dx, y: center.y + dy });
        }
      },
      [layoutNodes, nodeCenter],
    );
    const handleConnectionEnd = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const source = layoutNodes.find((node) => node.id === nodeId);
        if (!source) return;
        const center = nodeCenter(source);
        const target = layoutNodes.find((node) => {
          if (node.id === nodeId) return false;
          const targetCenter = nodeCenter(node);
          return Math.hypot(center.x + dx - targetCenter.x, center.y + dy - targetCenter.y) <= 80;
        });
        setConnectionDrag(null);
        if (target) onConnectNodes(nodeId, target.id);
      },
      [layoutNodes, nodeCenter, onConnectNodes],
    );

    const nodesById = useMemo(
      () => new Map(layoutNodes.map((node) => [node.id, node])),
      [layoutNodes],
    );
    const edges = useMemo(() => {
      const activeIds = new Set<string>();
      const next = content.edges.flatMap((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) return [];
        activeIds.add(edge.id);
        const geometry = boardEdgeGeometry(from, to, edge, galleryMediaById);
        edgeCacheRef.current.set(edge.id, geometry);
        return [geometry];
      });
      for (const id of edgeCacheRef.current.keys())
        if (!activeIds.has(id)) edgeCacheRef.current.delete(id);
      return next;
    }, [content.edges, galleryMediaById, nodesById]);
    const visibleEdges = useMemo(
      () =>
        edges.flatMap((edge) => {
          const segment = clipSpatialSegment(edge.start, edge.end, renderWindow);
          if (!segment) return [];
          const angle = Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x);
          const arrow = {
            x: segment.to.x,
            y: segment.to.y,
            points: [
              [segment.to.x, segment.to.y],
              [
                segment.to.x - 12 * Math.cos(angle - 0.4),
                segment.to.y - 12 * Math.sin(angle - 0.4),
              ],
              [
                segment.to.x - 12 * Math.cos(angle + 0.4),
                segment.to.y - 12 * Math.sin(angle + 0.4),
              ],
            ]
              .map((point) => point.join(','))
              .join(' '),
          };
          const labelVisible = spatialRectIntersects(
            { x: edge.labelX, y: edge.labelY, width: 1, height: 1 },
            renderWindow,
          );
          return [
            {
              ...edge,
              path: `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`,
              arrow,
              label: labelVisible ? edge.label : null,
            },
          ];
        }),
      [edges, renderWindow],
    );
    const visibleNodes = useMemo(
      () =>
        layoutNodes.filter((node) => {
          if (node.id === activeDrag?.id) return true;
          const size = boardNodeSize(
            node,
            node.kind === 'entity' ? galleryMediaById?.[node.entityId] : undefined,
          );
          return spatialRectIntersects({ x: node.x, y: node.y, ...size }, renderWindow);
        }),
      [activeDrag?.id, galleryMediaById, layoutNodes, renderWindow],
    );
    const stackedNodes = useMemo(
      () =>
        visibleNodes
          .map((node, order) => ({ node, order }))
          .sort(
            (left, right) =>
              (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0) || left.order - right.order,
          )
          .map(({ node }) => node),
      [visibleNodes],
    );
    const visibleStamps = useMemo(
      () =>
        (content.overlays ?? [])
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
      [content.overlays, renderWindow],
    );
    const snapTargets = useMemo(
      () => layoutNodes.map((node) => nodeCenter(node)),
      [layoutNodes, nodeCenter],
    );
    const selectedOverlay = selectedOverlayId
      ? ((content.overlays ?? []).find((overlay) => overlay.id === selectedOverlayId) ?? null)
      : null;
    const connectionPath = useMemo(() => {
      if (!connectionDrag) return null;
      const source = nodesById.get(connectionDrag.fromNodeId);
      if (!source) return null;
      const segment = clipSpatialSegment(nodeCenter(source), connectionDrag, renderWindow);
      return segment
        ? `M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`
        : null;
    }, [connectionDrag, nodeCenter, nodesById, renderWindow]);

    const overlay =
      width > 0 && height > 0 ? (
        <SkiaOverlayErrorBoundary canvas="board">
          <SkiaEdgeCanvas camera={cameraTransform}>
            {visibleEdges.map((edge) => (
              <BoardEdgeView
                key={edge.id}
                edge={edge}
                stroke={colors.text}
                labelBackground={colors.background}
                font={edgeFont}
              />
            ))}
            <CanvasOverlayLayer
              overlays={content.overlays}
              renderWindow={renderWindow}
              stroke={colors.text}
              labelBackground={colors.background}
              font={edgeFont}
            />
            <OverlayDraftView
              points={draft?.points ?? null}
              rect={rectPreview}
              color={colors.primary}
              scale={scale}
            />
            {connectionPath && (
              <Path path={connectionPath} style="stroke" color={colors.primary} strokeWidth={2}>
                <DashPathEffect intervals={[6, 4]} />
              </Path>
            )}
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
              overlays={content.overlays}
              snapTargets={snapTargets}
              onDrawTap={overlayCallbacks.onDrawTap}
              onStampPlace={overlayCallbacks.onStampPlace}
              onDrawRect={(start, end) => {
                if (interactionMode.kind === 'draw')
                  overlayCallbacks.onDrawRect(interactionMode.tool, start, end);
              }}
              onPreviewRect={setRectPreview}
              onSelectOverlay={overlayCallbacks.onSelectOverlay}
            />
          ) : null
        }
      >
        {stackedNodes.map((node) => {
          const meta = titles[node.id];
          return (
            <BoardNodeView
              key={node.id}
              node={node}
              title={meta?.title ?? node.kind}
              typeLabel={meta?.typeLabel ?? node.kind}
              appearanceType={meta?.appearanceType}
              appearance={meta?.appearance}
              ghost={meta?.ghost}
              selected={selectedNodeId === node.id}
              layoutEditing={layoutEditing}
              connectionMode={connectionMode}
              overlayEditing={overlayEditing}
              scale={scale}
              galleryMedia={
                node.kind === 'entity' && node.entityType === 'Gallery'
                  ? galleryMediaById?.[node.entityId]
                  : undefined
              }
              summary={summaries?.[node.id]}
              onSelect={onSelectNode}
              onMove={handleNodeDragMove}
              onResize={onResizeNode}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
              onOpenDetails={onOpenNodeDetails}
              onBringToFront={onBringNodeToFront}
              onSendToBack={onSendNodeToBack}
              onConnectionStart={handleConnectionStart}
              onConnectionMove={handleConnectionMove}
              onConnectionEnd={handleConnectionEnd}
              onConnectionCancel={() => setConnectionDrag(null)}
            />
          );
        })}
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
            onDeselect={overlayCallbacks.onDeselectOverlay}
          />
        )}
      </GraphCanvasFrame>
    );
  },
);

BoardCanvas.displayName = 'BoardCanvas';

export default BoardCanvas;
