import type { LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import type { PanZoomCanvasHandle } from '@/src/hooks/usePanZoomCanvas';
import { usePanZoomCanvas } from '@/src/hooks/usePanZoomCanvas';
import { useGrowingCanvasBounds } from '@/src/hooks/useGrowingCanvasBounds';
import {
  locationMapCanvasBounds,
  LOCATION_MAP_NODE_SIZE,
} from '@keres/shared/graphs/locationMapLayout';
import { useTheme } from '../../../theme';
import LocationMapConnectionLayer, {
  type LocationMapConnection,
  type LocationMapContains,
} from './LocationMapConnectionLayer';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = PanZoomCanvasHandle;
export type { LocationMapConnection, LocationMapContains } from './LocationMapConnectionLayer';

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
  connectionMode: boolean;
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
  onConnectPoints: (fromPointId: string, toPointId: string) => void;
}

type ActiveDrag = {
  kind: 'image' | 'node' | 'marker';
  id: string;
  x: number;
  y: number;
};
type ConnectionDrag = { fromNodeId: string; x: number; y: number };

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
      connectionMode,
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
      onConnectPoints,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
    const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null);
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
    const handleConnectionStart = useCallback(
      (nodeId: string) => {
        const point = [...content.nodes, ...(content.markers ?? [])].find(
          (candidate) => candidate.id === nodeId,
        );
        if (point) setConnectionDrag({ fromNodeId: nodeId, x: point.x, y: point.y });
      },
      [content.markers, content.nodes],
    );
    const handleConnectionMove = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const point = [...content.nodes, ...(content.markers ?? [])].find(
          (candidate) => candidate.id === nodeId,
        );
        if (point) setConnectionDrag({ fromNodeId: nodeId, x: point.x + dx, y: point.y + dy });
      },
      [content.markers, content.nodes],
    );
    const handleConnectionEnd = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const points = [...content.nodes, ...(content.markers ?? [])];
        const source = points.find((point) => point.id === nodeId);
        if (!source) return;
        const x = source.x + dx;
        const y = source.y + dy;
        const target = points.find(
          (point) =>
            point.id !== nodeId &&
            Math.hypot(x - point.x, y - point.y) <= LOCATION_MAP_NODE_SIZE / 2,
        );
        setConnectionDrag(null);
        if (target) onConnectPoints(nodeId, target.id);
      },
      [content.markers, content.nodes, onConnectPoints],
    );

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
        <LocationMapConnectionLayer
          width={size.width}
          height={size.height}
          content={layoutContent}
          connections={connections}
          contains={contains}
          connectionDrag={connectionDrag}
          originX={size.originX}
          originY={size.originY}
          background={colors.background}
          primary={colors.primary}
        />
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
              connectionMode={connectionMode}
              scale={scale}
              positionOffsetX={-size.originX}
              positionOffsetY={-size.originY}
              onSelect={kind === 'node' ? onSelectNode : onSelectMarker}
              onMove={kind === 'node' ? handleNodeDragMove : handleMarkerDragMove}
              onDragStart={handleNodeDragStart}
              onDragEnd={kind === 'node' ? handleNodeDragEnd : handleMarkerDragEnd}
              onBringToFront={kind === 'node' ? onBringNodeToFront : onBringMarkerToFront}
              onSendToBack={kind === 'node' ? onSendNodeToBack : onSendMarkerToBack}
              onOpenDestination={kind === 'node' ? onOpenNodeDestination : onOpenMarkerDestination}
              onConnectionStart={handleConnectionStart}
              onConnectionMove={handleConnectionMove}
              onConnectionEnd={handleConnectionEnd}
              onConnectionCancel={() => setConnectionDrag(null)}
            />
          ))}
        </View>
      </GraphCanvasFrame>
    );
  },
);

LocationMapCanvas.displayName = 'LocationMapCanvas';

export default LocationMapCanvas;
