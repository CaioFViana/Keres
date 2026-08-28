import type { BoardContentType, BoardNodeType } from '@keres/shared';
import React, { forwardRef, useMemo } from 'react';
import Svg, { Path, Polygon, Text as SvgText } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useTheme } from '../../../theme';
import { boardEdgeGeometry } from '../../../utils/boardEdges';
import { boardCanvasSize, type BoardGalleryMediaById } from '../../../utils/boardLayout';
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

const BoardCanvas = forwardRef<BoardCanvasHandle, Props>(
  ({ content, titles, selectedNodeId, galleryMediaById, onSelectNode, onMoveNode }, ref) => {
    const { colors } = useTheme();
    const size = boardCanvasSize(content.nodes, undefined, undefined, galleryMediaById);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;
    const nodesById = useMemo(() => {
      const map = new Map(content.nodes.map((node) => [node.id, node]));
      return map;
    }, [content.nodes]);

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
        {content.nodes.map((node) => {
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
              onSelect={() => onSelectNode(node)}
              onMove={(x, y) => onMoveNode(node.id, x, y)}
              onDragStart={() => setChildDragging(true)}
              onDragEnd={() => setChildDragging(false)}
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
