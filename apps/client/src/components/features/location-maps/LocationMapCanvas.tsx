import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Path, Polygon } from 'react-native-svg';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useGrowingCanvasBounds } from '@/src/hooks/useGrowingCanvasBounds';
import { interpolateColor, pointOnCircleBoundary } from '@keres/shared/graphs/locationMapGeometry';
import {
  locationMapCanvasBounds,
  LOCATION_MAP_NODE_SIZE,
} from '@keres/shared/graphs/locationMapLayout';
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
  selectedMarkerId: string | null;
  layoutEditing: boolean;
  onSelectImage: (imageId: string) => void;
  onMoveImage: (imageId: string, x: number, y: number) => void;
  onResizeImage: (imageId: string, width: number, height: number) => void;
  onBringImageToFront: (imageId: string) => void;
  onSendImageToBack: (imageId: string) => void;
  onToggleImageLock: (imageId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onBringNodeToFront: (nodeId: string) => void;
  onSendNodeToBack: (nodeId: string) => void;
  onBringMarkerToFront: (markerId: string) => void;
  onSendMarkerToBack: (markerId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onSelectMarker: (markerId: string) => void;
  onMoveMarker: (markerId: string, x: number, y: number) => void;
  onOpenNodeDestination: (nodeId: string) => void;
  onOpenMarkerDestination: (markerId: string) => void;
}

const NODE_RADIUS = LOCATION_MAP_NODE_SIZE / 2;
/** How far the line's tip stays from the node's border - the arrow must not be buried under it. */
const LINE_END_MARGIN = 3;
const CONTAINS_DASH = '6 4';
/** Width of the contrast halo behind every line, so it stays visible over the image bases. */
const HALO_WIDTH = 6;

type ActiveDrag = {
  kind: 'image' | 'node' | 'marker';
  id: string;
  x: number;
  y: number;
};

type WorldNode = LocationMapContentType['nodes'][number];
type ConnectionPath = { id: string; path: string; color: string };
type ContainsArrow = {
  id: string;
  path: string;
  arrow: string;
  arrowHalo: string;
  color: string;
};

const ConnectionPathView = React.memo(function ConnectionPathView({
  path,
  background,
}: {
  path: ConnectionPath;
  background: string;
}) {
  return (
    <>
      <Path
        d={path.path}
        fill="none"
        stroke={background}
        strokeWidth={HALO_WIDTH}
        strokeOpacity={0.9}
      />
      <Path d={path.path} fill="none" stroke={path.color} strokeWidth={2} strokeOpacity={0.85} />
    </>
  );
});

const ContainsArrowView = React.memo(function ContainsArrowView({
  arrow,
  background,
}: {
  arrow: ContainsArrow;
  background: string;
}) {
  return (
    <>
      <Path
        d={arrow.path}
        fill="none"
        stroke={background}
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
      <Polygon points={arrow.arrowHalo} fill={background} />
      <Polygon points={arrow.arrow} fill={arrow.color} />
    </>
  );
});

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
      selectedMarkerId,
      layoutEditing,
      onSelectImage,
      onMoveImage,
      onResizeImage,
      onBringImageToFront,
      onSendImageToBack,
      onToggleImageLock,
      onRemoveImage,
      onBringNodeToFront,
      onSendNodeToBack,
      onBringMarkerToFront,
      onSendMarkerToBack,
      onSelectNode,
      onMoveNode,
      onSelectMarker,
      onMoveMarker,
      onOpenNodeDestination,
      onOpenMarkerDestination,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const pendingDragRef = useRef<ActiveDrag | null>(null);
    const dragFrameRef = useRef<number | null>(null);
    const connectionCacheRef = useRef(
      new Map<
        string,
        { relation: LocationMapConnection; from: WorldNode; to: WorldNode; path: ConnectionPath }
      >(),
    );
    const containsCacheRef = useRef(
      new Map<
        string,
        { relation: LocationMapContains; from: WorldNode; to: WorldNode; arrow: ContainsArrow }
      >(),
    );
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
      if (activeDrag.kind === 'node')
        return {
          ...content,
          nodes: content.nodes.map((node) =>
            node.id === activeDrag.id ? { ...node, x: activeDrag.x, y: activeDrag.y } : node,
          ),
        };
      return {
        ...content,
        markers: (content.markers ?? []).map((marker) =>
          marker.id === activeDrag.id ? { ...marker, x: activeDrag.x, y: activeDrag.y } : marker,
        ),
      };
    }, [activeDrag, content]);
    const requiredSize = locationMapCanvasBounds(layoutContent);
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
    const handleMarkerDragMove = useCallback(
      (markerId: string, x: number, y: number) => updateDrag('marker', markerId, x, y),
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
    const handleMarkerDragEnd = useCallback(
      (markerId: string) => {
        setChildDragging(false);
        const position = consumeDrag('marker', markerId);
        if (position) onMoveMarker(markerId, position.x, position.y);
      },
      [consumeDrag, onMoveMarker, setChildDragging],
    );

    const nodesByLocation = useMemo(() => {
      const map = new Map<string, WorldNode>();
      for (const node of layoutContent.nodes) {
        map.set(node.locationId, node);
      }
      return map;
    }, [layoutContent.nodes]);

    // `connected_to` is a solid line between the two nodes' borders, coloured halfway between the
    // two nodes' colours.
    const connectionPaths = useMemo(() => {
      const activeIds = new Set<string>();
      const next = connections.flatMap((connection) => {
        const from = nodesByLocation.get(connection.locationAId);
        const to = nodesByLocation.get(connection.locationBId);
        if (!from || !to) return [];
        const id = `${connection.locationAId}-${connection.locationBId}`;
        activeIds.add(id);
        const cached = connectionCacheRef.current.get(id);
        if (cached?.relation === connection && cached.from === from && cached.to === to)
          return [cached.path];
        const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
        const end = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
        const path = {
          id,
          path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
          color: interpolateColor(from.color, to.color),
        };
        connectionCacheRef.current.set(id, { relation: connection, from, to, path });
        return [path];
      });
      for (const id of connectionCacheRef.current.keys()) {
        if (!activeIds.has(id)) connectionCacheRef.current.delete(id);
      }
      return next;
    }, [connections, nodesByLocation]);

    // `contains` is a dashed arrow from the parent's border to the child's border, so the tip is
    // visible instead of hidden under the target node.
    const containsArrows = useMemo(() => {
      const activeIds = new Set<string>();
      const next = contains.flatMap((relation) => {
        const from = nodesByLocation.get(relation.parentLocationId);
        const to = nodesByLocation.get(relation.childLocationId);
        if (!from || !to) return [];
        const id = `${relation.parentLocationId}-${relation.childLocationId}`;
        activeIds.add(id);
        const cached = containsCacheRef.current.get(id);
        if (cached?.relation === relation && cached.from === from && cached.to === to)
          return [cached.arrow];
        const start = pointOnCircleBoundary(from, to, NODE_RADIUS + LINE_END_MARGIN);
        const tip = pointOnCircleBoundary(to, from, NODE_RADIUS + LINE_END_MARGIN);
        const angle = Math.atan2(tip.y - start.y, tip.x - start.x);
        const arrow = {
          id,
          path: `M ${start.x} ${start.y} L ${tip.x} ${tip.y}`,
          arrow: arrowHeadPoints(tip.x, tip.y, angle, 10),
          arrowHalo: arrowHeadPoints(tip.x, tip.y, angle, 13),
          color: interpolateColor(from.color, to.color),
        };
        containsCacheRef.current.set(id, { relation, from, to, arrow });
        return [arrow];
      });
      for (const id of containsCacheRef.current.keys()) {
        if (!activeIds.has(id)) containsCacheRef.current.delete(id);
      }
      return next;
    }, [contains, nodesByLocation]);
    const stackedImages = useMemo(
      () =>
        layoutContent.images
          .map((image, order) => ({ image, order }))
          .sort(
            (left, right) =>
              (left.image.zIndex ?? 0) - (right.image.zIndex ?? 0) || left.order - right.order,
          )
          .map(({ image }) => image),
      [layoutContent.images],
    );
    const stackedNodes = useMemo(
      () =>
        layoutContent.nodes
          .map((node, order) => ({ node, order }))
          .sort(
            (left, right) =>
              (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0) || left.order - right.order,
          )
          .map(({ node }) => node),
      [layoutContent.nodes],
    );
    const stackedMarkers = useMemo(
      () =>
        (layoutContent.markers ?? [])
          .map((marker, order) => ({ marker, order }))
          .sort(
            (left, right) =>
              (left.marker.zIndex ?? 0) - (right.marker.zIndex ?? 0) || left.order - right.order,
          )
          .map(({ marker }) => marker),
      [layoutContent.markers],
    );
    const stackedPoints = useMemo(
      () =>
        [
          ...stackedNodes.map((node, order) => ({ kind: 'node' as const, point: node, order })),
          ...stackedMarkers.map((marker, order) => ({
            kind: 'marker' as const,
            point: marker,
            order: order + stackedNodes.length,
          })),
        ].sort(
          (left, right) =>
            (left.point.zIndex ?? 0) - (right.point.zIndex ?? 0) || left.order - right.order,
        ),
      [stackedMarkers, stackedNodes],
    );

    return (
      <GraphCanvasFrame
        width={size.width}
        height={size.height}
        contentOverflow="visible"
        {...frame}
      >
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
          {stackedImages.map((image) => (
            <LocationMapImageView
              key={image.id}
              image={image}
              uri={imageUris[image.galleryId] ?? null}
              selected={selectedImageId === image.id}
              layoutEditing={layoutEditing}
              scale={scale}
              positionOffsetX={-size.originX}
              positionOffsetY={-size.originY}
              locked={image.locked}
              onSelect={onSelectImage}
              onMove={handleImageDragMove}
              onResize={onResizeImage}
              onDragStart={handleImageDragStart}
              onDragEnd={handleImageDragEnd}
              onBringToFront={onBringImageToFront}
              onSendToBack={onSendImageToBack}
              onToggleLock={onToggleImageLock}
              onRemove={onRemoveImage}
            />
          ))}
        </View>
        <Svg
          width={size.width}
          height={size.height}
          pointerEvents="none"
          style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0, zIndex: 1 }}
        >
          <G transform={`translate(${-size.originX} ${-size.originY})`}>
            {connectionPaths.map((connection) => (
              <ConnectionPathView
                key={connection.id}
                path={connection}
                background={colors.background}
              />
            ))}
            {containsArrows.map((arrow) => (
              <ContainsArrowView key={arrow.id} arrow={arrow} background={colors.background} />
            ))}
          </G>
        </Svg>
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
          {stackedPoints.map(({ kind, point }) => (
            <LocationMapNodeView
              key={point.id}
              node={point}
              name={
                kind === 'node' ? (nodeNames[point.locationId] ?? point.locationId) : point.title
              }
              selected={
                kind === 'node' ? selectedNodeId === point.id : selectedMarkerId === point.id
              }
              layoutEditing={layoutEditing}
              scale={scale}
              positionOffsetX={-size.originX}
              positionOffsetY={-size.originY}
              onSelect={kind === 'node' ? onSelectNode : onSelectMarker}
              onMove={kind === 'node' ? handleNodeDragMove : handleMarkerDragMove}
              onDragStart={handleNodeDragStart}
              onDragEnd={kind === 'node' ? handleNodeDragEnd : handleMarkerDragEnd}
              onBringToFront={kind === 'node' ? onBringNodeToFront : onBringMarkerToFront}
              onSendToBack={kind === 'node' ? onSendNodeToBack : onSendMarkerToBack}
              onOpenDestination={
                kind === 'node' ? onOpenNodeDestination : onOpenMarkerDestination
              }
            />
          ))}
        </View>
      </GraphCanvasFrame>
    );
  },
);

LocationMapCanvas.displayName = 'LocationMapCanvas';

export default LocationMapCanvas;
