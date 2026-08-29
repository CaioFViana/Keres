import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { interpolateColor, pointOnCircleBoundary } from '../../../utils/locationMapColors';
import { locationMapCanvasBounds, LOCATION_MAP_NODE_SIZE } from '../../../utils/locationMapLayout';
import { useTheme } from '../../../theme';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = PanZoomCanvasHandle;

export interface LocationMapConnection {
  locationAId: string;
  locationBId: string;
}

/** A `contains` relation: `parentLocationId` contains `childLocationId`. */
export interface LocationMapContains {
  parentLocationId: string;
  childLocationId: string;
}

interface Props {
  content: LocationMapContentType;
  /** Resolved URIs of the gallery media used as image bases, keyed by gallery id. */
  imageUris: Record<string, string | null>;
  /** Display names of the locations, keyed by location id. */
  nodeNames: Record<string, string>;
  /** Real `connected_to` relations between locations, drawn as solid lines. */
  connections: LocationMapConnection[];
  /** Real `contains` relations between locations, drawn as dashed directional arrows. */
  contains: LocationMapContains[];
  selectedImageId: string | null;
  selectedNodeId: string | null;
  onSelectImage: (imageId: string) => void;
  onMoveImage: (imageId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
/** How far the line's tip stays from the node's border - the arrow must not be buried under it. */
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';
/** Width of the contrast halo behind every line, so it stays visible over the image bases. */
const HALO_WIDTH = 6;

type ActiveDrag = {
  kind: 'image' | 'node';
  id: string;
  x: number;
  y: number;
};

/** A triangle marking the arrow's tip, pointing along `angle` (radians). */
function arrowHeadPoints(tipX: number, tipY: number, angle: number, size: number): string {
  return [
    [tipX, tipY],
    [tipX - size * Math.cos(angle - 0.4), tipY - size * Math.sin(angle - 0.4)],
    [tipX - size * Math.cos(angle + 0.4), tipY - size * Math.sin(angle + 0.4)],
  ]
    .map((pair) => pair.join(','))
    .join(' ');
}

const LocationMapCanvas = forwardRef<LocationMapCanvasHandle, Props>(
  (
    {
      content,
      imageUris,
      nodeNames,
      connections,
      contains,
      selectedImageId,
      selectedNodeId,
      onSelectImage,
      onMoveImage,
      onSelectNode,
      onMoveNode,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const pendingDragRef = useRef<ActiveDrag | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    // The drag is measured in the surface coordinates from press time. That surface can gain a
    // negative-world margin while the pointer moves, so do not rebase a running gesture on it.
    const dragWorldOriginRef = useRef({ x: 0, y: 0 });
    const layoutContent = useMemo(() => {
      if (!activeDrag) return content;
      if (activeDrag.kind === 'image') {
        return {
          ...content,
          images: content.images.map((image) =>
            image.id === activeDrag.id ? { ...image, x: activeDrag.x, y: activeDrag.y } : image,
          ),
        };
      }
      return {
        ...content,
        nodes: content.nodes.map((node) =>
          node.id === activeDrag.id ? { ...node, x: activeDrag.x, y: activeDrag.y } : node,
        ),
      };
    }, [activeDrag, content]);
    const size = locationMapCanvasBounds(layoutContent);
    const panZoom = usePanZoomCanvas(ref, size, { refitOnLayoutChange: false, freePan: true });
    const { setChildDragging, getTransform, ...frame } = panZoom;
    const scale = getTransform().scale;

    const displayContent = useMemo(() => {
      if (size.originX === 0 && size.originY === 0) return layoutContent;
      return {
        ...layoutContent,
        images: layoutContent.images.map((image) => ({
          ...image,
          x: image.x - size.originX,
          y: image.y - size.originY,
        })),
        nodes: layoutContent.nodes.map((node) => ({
          ...node,
          x: node.x - size.originX,
          y: node.y - size.originY,
        })),
      };
    }, [layoutContent, size.originX, size.originY]);

    const publishPendingDrag = useCallback(() => {
      dragFrameRef.current = null;
      const next = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!next) return;
      activeDragRef.current = next;
      setActiveDrag(next);
    }, []);

    const updateDrag = useCallback(
      (kind: ActiveDrag['kind'], id: string, x: number, y: number) => {
        pendingDragRef.current = {
          kind,
          id,
          x: x + dragWorldOriginRef.current.x,
          y: y + dragWorldOriginRef.current.y,
        };
        if (dragFrameRef.current !== null) return;
        // Pointer events can arrive more often than a screen can paint. One visual update per
        // animation frame keeps the moving item and its lines smooth without redrawing the whole
        // editor for every raw event.
        dragFrameRef.current = requestAnimationFrame(publishPendingDrag);
      },
      [publishPendingDrag],
    );
    const handleImageDragMove = useCallback(
      (imageId: string, x: number, y: number) => updateDrag('image', imageId, x, y),
      [updateDrag],
    );
    const handleNodeDragMove = useCallback(
      (nodeId: string, x: number, y: number) => updateDrag('node', nodeId, x, y),
      [updateDrag],
    );

    const consumeDrag = useCallback((kind: ActiveDrag['kind'], id: string) => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      const next = pendingDragRef.current ?? activeDragRef.current;
      pendingDragRef.current = null;
      activeDragRef.current = null;
      setActiveDrag(null);
      return next?.kind === kind && next.id === id ? next : null;
    }, []);

    const handleImageDragStart = useCallback(() => {
      dragWorldOriginRef.current = { x: size.originX, y: size.originY };
      setChildDragging(true);
    }, [setChildDragging, size.originX, size.originY]);
    const handleNodeDragStart = useCallback(() => {
      dragWorldOriginRef.current = { x: size.originX, y: size.originY };
      setChildDragging(true);
    }, [setChildDragging, size.originX, size.originY]);
    const handleImageDragEnd = useCallback(
      (imageId: string) => {
        setChildDragging(false);
        const position = consumeDrag('image', imageId);
        if (position) onMoveImage(imageId, position.x, position.y);
      },
      [consumeDrag, onMoveImage, setChildDragging],
    );
    const handleNodeDragEnd = useCallback(
      (nodeId: string) => {
        setChildDragging(false);
        const position = consumeDrag('node', nodeId);
        if (position) onMoveNode(nodeId, position.x, position.y);
      },
      [consumeDrag, onMoveNode, setChildDragging],
    );

    const byLocation = useMemo(() => {
      const map = new Map<string, { x: number; y: number; color: string }>();
      for (const node of displayContent.nodes) {
        map.set(node.locationId, { x: node.x, y: node.y, color: node.color });
      }
      return map;
    }, [displayContent.nodes]);

    // `connected_to` is a solid line between the two nodes' borders, coloured halfway between the
    // two nodes' colours.
    const connectionPaths = useMemo(
      () =>
        connections
          .filter(
            (connection) =>
              byLocation.has(connection.locationAId) && byLocation.has(connection.locationBId),
          )
          .map((connection) => {
            const a = byLocation.get(connection.locationAId)!;
            const b = byLocation.get(connection.locationBId)!;
            const start = pointOnCircleBoundary(a, b, NODE_RADIUS + LINE_END_MARGIN);
            const end = pointOnCircleBoundary(b, a, NODE_RADIUS + LINE_END_MARGIN);
            return {
              id: `${connection.locationAId}-${connection.locationBId}`,
              path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
              color: interpolateColor(a.color, b.color),
            };
          }),
      [byLocation, connections],
    );

    // `contains` is a dashed arrow from the parent's border to the child's border, so the tip is
    // visible instead of hidden under the target node.
    const containsArrows = useMemo(
      () =>
        contains
          .filter(
            (relation) =>
              byLocation.has(relation.parentLocationId) && byLocation.has(relation.childLocationId),
          )
          .map((relation) => {
            const from = byLocation.get(relation.parentLocationId)!;
            const to = byLocation.get(relation.childLocationId)!;
            const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
            const tip = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
            const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
            return {
              id: `${relation.parentLocationId}-${relation.childLocationId}`,
              path: `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`,
              arrow: arrowHeadPoints(tip.x, tip.y, angle, 10),
              arrowHalo: arrowHeadPoints(tip.x, tip.y, angle, 13),
              color: interpolateColor(from.color, to.color),
            };
          }),
      [byLocation, contains],
    );

    return (
      <GraphCanvasFrame
        width={size.width}
        height={size.height}
        contentOverflow="visible"
        {...frame}
      >
        {displayContent.images.map((image) => (
          <LocationMapImageView
            key={image.id}
            image={image}
            uri={imageUris[image.galleryId] ?? null}
            selected={selectedImageId === image.id}
            scale={scale}
            locked={image.locked}
            onSelect={onSelectImage}
            onMove={handleImageDragMove}
            onDragStart={handleImageDragStart}
            onDragEnd={handleImageDragEnd}
          />
        ))}
        <Svg
          width={size.width}
          height={size.height}
          pointerEvents="none"
          style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}
        >
          {connectionPaths.map((connection) => (
            <React.Fragment key={connection.id}>
              <Path
                d={connection.path}
                fill="none"
                stroke={colors.background}
                strokeWidth={HALO_WIDTH}
                strokeOpacity={0.9}
              />
              <Path
                d={connection.path}
                fill="none"
                stroke={connection.color}
                strokeWidth={2}
                strokeOpacity={0.85}
              />
            </React.Fragment>
          ))}
          {containsArrows.map((arrow) => (
            <React.Fragment key={arrow.id}>
              <Path
                d={arrow.path}
                fill="none"
                stroke={colors.background}
                strokeWidth={HALO_WIDTH}
                strokeOpacity={0.9}
              />
              <Path
                d={arrow.path}
                fill="none"
                stroke={arrow.color}
                strokeWidth={2}
                strokeDasharray={CONTAINS_DASH}
                strokeOpacity={0.85}
              />
              <Polygon points={arrow.arrowHalo} fill={colors.background} />
              <Polygon points={arrow.arrow} fill={arrow.color} />
            </React.Fragment>
          ))}
        </Svg>
        {displayContent.nodes.map((node) => (
          <LocationMapNodeView
            key={node.id}
            node={node}
            name={nodeNames[node.locationId] ?? node.locationId}
            selected={selectedNodeId === node.id}
            scale={scale}
            onSelect={onSelectNode}
            onMove={handleNodeDragMove}
            onDragStart={handleNodeDragStart}
            onDragEnd={handleNodeDragEnd}
          />
        ))}
      </GraphCanvasFrame>
    );
  },
);

LocationMapCanvas.displayName = 'LocationMapCanvas';

export default LocationMapCanvas;
