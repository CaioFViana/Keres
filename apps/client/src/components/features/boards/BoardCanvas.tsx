import type { BoardContentType, BoardNodeType } from '@keres/shared';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import Svg, { G, Path, Polygon, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useGrowingCanvasBounds } from '@/src/hooks/useGrowingCanvasBounds';
import { useTheme } from '../../../theme';
import { boardEdgeGeometry } from '../../../utils/boardEdges';
import {
  boardCanvasBounds,
  boardNodeSize,
  type BoardGalleryMediaById,
} from '../../../utils/boardLayout';
import type { BoardEntitySummary } from '../../../utils/boardEntitySummary';
import type { BoardCardAppearance } from '../../../utils/boardPinAppearance';
import BoardNodeView from './BoardNode';

export type BoardCanvasHandle = PanZoomCanvasHandle;

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
  /** Media of the story's galleries - lets Gallery pins show their image. */
  galleryMediaById?: BoardGalleryMediaById;
  summaries?: Record<string, BoardEntitySummary | null>;
  onSelectNode: (node: BoardNodeType) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onResizeNode: (nodeId: string, width: number, height: number) => void;
  onOpenNodeDetails: (node: BoardNodeType) => void;
  onBringNodeToFront: (nodeId: string) => void;
  onSendNodeToBack: (nodeId: string) => void;
  onConnectNodes: (fromNodeId: string, toNodeId: string) => void;
}

type ActiveDrag = { id: string; x: number; y: number };
type ConnectionDrag = { fromNodeId: string; x: number; y: number };
type BoardEdgeGeometry = ReturnType<typeof boardEdgeGeometry>;

/** Individual SVG edges stay mounted; only an edge whose cached geometry changed updates on drag. */
const BoardEdgeView = React.memo(function BoardEdgeView({
  edge,
  stroke,
  labelBackground,
}: {
  edge: BoardEdgeGeometry;
  stroke: string;
  labelBackground: string;
}) {
  return (
    <>
      <Path
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={edge.directed ? 2 : 1.6}
        strokeOpacity={0.85}
      />
      {edge.directed && <Polygon points={edge.arrow.points} fill={stroke} />}
      {!!edge.label && (
        <>
          <SvgText
            x={edge.labelX}
            y={edge.labelY}
            fill={labelBackground}
            stroke={labelBackground}
            strokeWidth={4}
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
          >
            {edge.label}
          </SvgText>
          <SvgText
            x={edge.labelX}
            y={edge.labelY}
            fill={stroke}
            fontSize={11}
            fontWeight="600"
            textAnchor="middle"
          >
            {edge.label}
          </SvgText>
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
      galleryMediaById,
      summaries,
      onSelectNode,
      onMoveNode,
      onResizeNode,
      onOpenNodeDetails,
      onBringNodeToFront,
      onSendNodeToBack,
      onConnectNodes,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const pendingDragRef = useRef<ActiveDrag | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const edgeCacheRef = useRef(
      new Map<
        string,
        {
          edge: BoardContentType['edges'][number];
          from: BoardNodeType;
          to: BoardNodeType;
          galleryMediaById: BoardGalleryMediaById | undefined;
          geometry: BoardEdgeGeometry;
        }
      >(),
    );
    // Gesture coordinates remain relative to the surface that existed at press time. The surface
    // may grow while dragging past zero, so this origin must stay fixed until release.
    const dragWorldOriginRef = useRef({ x: 0, y: 0 });
    const layoutNodes = useMemo(
      () =>
        activeDrag
          ? content.nodes.map((node) =>
              node.id === activeDrag.id ? { ...node, x: activeDrag.x, y: activeDrag.y } : node,
            )
          : content.nodes,
      [activeDrag, content.nodes],
    );
    const requiredSize = boardCanvasBounds(layoutNodes, undefined, undefined, galleryMediaById);
    const size = useGrowingCanvasBounds(requiredSize);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;

    const publishPendingDrag = useCallback(() => {
      dragFrameRef.current = null;
      const next = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!next) return;
      activeDragRef.current = next;
      setActiveDrag(next);
    }, []);
    const handleNodeDragMove = useCallback(
      (nodeId: string, x: number, y: number) => {
        pendingDragRef.current = {
          id: nodeId,
          x: x + dragWorldOriginRef.current.x,
          y: y + dragWorldOriginRef.current.y,
        };
        if (dragFrameRef.current !== null) return;
        // Coalesce raw pointer events to the display's cadence. The permanent board content is
        // intentionally untouched until the drag ends, avoiding full-screen work per pixel.
        dragFrameRef.current = requestAnimationFrame(publishPendingDrag);
      },
      [publishPendingDrag],
    );
    const consumeNodeDrag = useCallback((nodeId: string) => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      const next = pendingDragRef.current ?? activeDragRef.current;
      pendingDragRef.current = null;
      activeDragRef.current = null;
      setActiveDrag(null);
      return next?.id === nodeId ? next : null;
    }, []);
    const handleNodeDragStart = useCallback(() => {
      dragWorldOriginRef.current = { x: size.originX, y: size.originY };
      setChildDragging(true);
    }, [setChildDragging, size.originX, size.originY]);
    const handleNodeDragEnd = useCallback(
      (nodeId: string) => {
        setChildDragging(false);
        const position = consumeNodeDrag(nodeId);
        if (position) onMoveNode(nodeId, position.x, position.y);
      },
      [consumeNodeDrag, onMoveNode, setChildDragging],
    );
    const nodeCenter = useCallback(
      (node: BoardNodeType) => {
        const nodeSize = boardNodeSize(
          node,
          node.kind === 'entity' ? galleryMediaById?.[node.entityId] : undefined,
        );
        return { x: node.x + nodeSize.width / 2, y: node.y + nodeSize.height / 2 };
      },
      [galleryMediaById],
    );
    const handleConnectionStart = useCallback(
      (node: BoardNodeType) => {
        const center = nodeCenter(node);
        setConnectionDrag({ fromNodeId: node.id, ...center });
      },
      [nodeCenter],
    );
    const handleConnectionMove = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const node = layoutNodes.find((candidate) => candidate.id === nodeId);
        if (!node) return;
        const center = nodeCenter(node);
        setConnectionDrag({ fromNodeId: nodeId, x: center.x + dx, y: center.y + dy });
      },
      [layoutNodes, nodeCenter],
    );
    const handleConnectionEnd = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const source = layoutNodes.find((node) => node.id === nodeId);
        if (!source) return;
        const center = nodeCenter(source);
        const x = center.x + dx;
        const y = center.y + dy;
        const target = layoutNodes.find((node) => {
          if (node.id === nodeId) return false;
          const nodeSize = boardNodeSize(
            node,
            galleryMediaById?.[node.kind === 'entity' ? node.entityId : ''],
          );
          return (
            x >= node.x &&
            x <= node.x + nodeSize.width &&
            y >= node.y &&
            y <= node.y + nodeSize.height
          );
        });
        setConnectionDrag(null);
        if (target) onConnectNodes(nodeId, target.id);
      },
      [galleryMediaById, layoutNodes, nodeCenter, onConnectNodes],
    );
    const nodesById = useMemo(() => {
      const map = new Map(layoutNodes.map((node) => [node.id, node]));
      return map;
    }, [layoutNodes]);

    const edges = useMemo(() => {
      const activeIds = new Set<string>();
      const next = content.edges.flatMap((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) return [];
        activeIds.add(edge.id);
        const cached = edgeCacheRef.current.get(edge.id);
        if (
          cached?.edge === edge &&
          cached.from === from &&
          cached.to === to &&
          cached.galleryMediaById === galleryMediaById
        ) {
          return [cached.geometry];
        }
        const geometry = boardEdgeGeometry(from, to, edge, galleryMediaById);
        edgeCacheRef.current.set(edge.id, { edge, from, to, galleryMediaById, geometry });
        return [geometry];
      });
      for (const id of edgeCacheRef.current.keys()) {
        if (!activeIds.has(id)) edgeCacheRef.current.delete(id);
      }
      return next;
    }, [content.edges, galleryMediaById, nodesById]);
    const stackedNodes = useMemo(
      () =>
        layoutNodes
          .map((node, order) => ({ node, order }))
          .sort(
            (left, right) =>
              (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0) || left.order - right.order,
          )
          .map(({ node }) => node),
      [layoutNodes],
    );
    const connectionPath = useMemo(() => {
      if (!connectionDrag) return null;
      const source = layoutNodes.find((node) => node.id === connectionDrag.fromNodeId);
      if (!source) return null;
      const start = nodeCenter(source);
      return `M ${start.x} ${start.y} L ${connectionDrag.x} ${connectionDrag.y}`;
    }, [connectionDrag, layoutNodes, nodeCenter]);

    return (
      <GraphCanvasFrame
        width={size.width}
        height={size.height}
        contentOverflow="visible"
        {...frame}
      >
        <Svg
          width={size.width}
          height={size.height}
          pointerEvents="none"
          style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}
        >
          <G transform={`translate(${-size.originX} ${-size.originY})`}>
            {edges.map((edge) => (
              <BoardEdgeView
                key={edge.id}
                edge={edge}
                stroke={colors.text}
                labelBackground={colors.background}
              />
            ))}
            {connectionPath && (
              <Path
                d={connectionPath}
                fill="none"
                stroke={colors.primary}
                strokeDasharray="6 4"
                strokeWidth={2}
              />
            )}
          </G>
        </Svg>
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
              scale={scale}
              positionOffsetX={-size.originX}
              positionOffsetY={-size.originY}
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
      </GraphCanvasFrame>
    );
  },
);

BoardCanvas.displayName = 'BoardCanvas';

export default BoardCanvas;
