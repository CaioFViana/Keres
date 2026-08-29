import type { BoardContentType, BoardNodeType } from '@keres/shared';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import { boardEdgeGeometry } from '../../../utils/boardEdges';
import { boardCanvasBounds, type BoardGalleryMediaById } from '../../../utils/boardLayout';
import BoardNodeView from './BoardNode';

export type BoardCanvasHandle = PanZoomCanvasHandle;

export interface BoardPinTitle {
  title: string;
  typeLabel: string;
  appearanceType?: string;
  ghost?: boolean;
}

interface Props {
  content: BoardContentType;
  titles: Record<string, BoardPinTitle>;
  selectedNodeId: string | null;
  /** Media of the story's galleries - lets Gallery pins show their image. */
  galleryMediaById?: BoardGalleryMediaById;
  onSelectNode: (node: BoardNodeType) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

type ActiveDrag = { id: string; x: number; y: number };

const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(
  ({ content, titles, selectedNodeId, galleryMediaById, onSelectNode, onMoveNode }, ref) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const pendingDragRef = useRef<ActiveDrag | null>(null);
    const dragFrameRef = useRef<number | null>(null);
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
    const size = boardCanvasBounds(layoutNodes, undefined, undefined, galleryMediaById);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;
    const displayNodes = useMemo(
      () =>
        size.originX === 0 && size.originY === 0
          ? layoutNodes
          : layoutNodes.map((node) => ({
              ...node,
              x: node.x - size.originX,
              y: node.y - size.originY,
            })),
      [layoutNodes, size.originX, size.originY],
    );

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
    const nodesById = useMemo(() => {
      const map = new Map(displayNodes.map((node) => [node.id, node]));
      return map;
    }, [displayNodes]);

    const edges = content.edges
      .map((edge) => {
        const from = nodesById.get(edge.from);
        const to = nodesById.get(edge.to);
        if (!from || !to) return null;
        return boardEdgeGeometry(from, to, edge, galleryMediaById);
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

    return (
      <GraphCanvasFrame
        width={size.width}
        height={size.height}
        contentOverflow="visible"
        {...frame}
      >
        {displayNodes.map((node) => {
          const meta = titles[node.id];
          return (
            <BoardNodeView
              key={node.id}
              node={node}
              title={meta?.title ?? node.kind}
              typeLabel={meta?.typeLabel ?? node.kind}
              appearanceType={meta?.appearanceType}
              ghost={meta?.ghost}
              selected={selectedNodeId === node.id}
              scale={scale}
              galleryMedia={
                node.kind === 'entity' && node.entityType === 'Gallery'
                  ? galleryMediaById?.[node.entityId]
                  : undefined
              }
              onSelect={onSelectNode}
              onMove={handleNodeDragMove}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
            />
          );
        })}
        <Svg
          width={size.width}
          height={size.height}
          pointerEvents="none"
          style={{ overflow: 'visible' }}
        >
          {edges.map((edge) => (
            <React.Fragment key={edge.id}>
              <Path
                d={edge.path}
                fill="none"
                stroke={colors.text}
                strokeWidth={edge.directed ? 2 : 1.6}
                strokeOpacity={0.85}
              />
              {edge.directed && <Polygon points={edge.arrow.points} fill={colors.text} />}
              {!!edge.label && (
                <React.Fragment>
                  <SvgText
                    x={edge.labelX}
                    y={edge.labelY}
                    fill={colors.background}
                    stroke={colors.background}
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
                    fill={colors.text}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </SvgText>
                </React.Fragment>
              )}
            </React.Fragment>
          ))}
        </Svg>
      </GraphCanvasFrame>
    );
  },
);

BoardCanvas.displayName = 'BoardCanvas';

export default BoardCanvas;
