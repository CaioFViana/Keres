import { spatialRectIntersects, type LocationMapContentType } from '@keres/shared';
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import GraphCanvasFrame from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import {
  type FreeformCanvasHandle,
  useFreeformCanvasViewport,
} from '@/src/hooks/useFreeformCanvasViewport';
import {
  locationMapCanvasBounds,
  LOCATION_MAP_NODE_SIZE,
} from '@keres/shared/graphs/locationMapLayout';
import { useTheme } from '../../../theme';
import { clampCanvasWorldCoordinate } from '../../../utils/canvasDragBounds';
import LocationMapConnectionLayer, {
  type LocationMapConnection,
  type LocationMapContains,
} from './LocationMapConnectionLayer';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = FreeformCanvasHandle;
export type { LocationMapConnection, LocationMapContains } from './LocationMapConnectionLayer';

interface Props {
  content: LocationMapContentType;
  imageUris: Record<string, string | null>;
  nodeNames: Record<string, string>;
  connections: LocationMapConnection[];
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

type ActiveDrag = { kind: 'image' | 'node' | 'marker'; id: string; x: number; y: number };
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
    const dragLocalOriginRef = useRef({ x: 0, y: 0 });
    const dragAutoPanOffsetRef = useRef({ x: 0, y: 0 });

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
    const adjustDraggedItemForAutoPan = useCallback(
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
      if (activeDrag.kind === 'node') {
        return {
          ...content,
          nodes: content.nodes.map((node) =>
            node.id === activeDrag.id ? { ...node, x: activeDrag.x, y: activeDrag.y } : node,
          ),
        };
      }
      return {
        ...content,
        markers: (content.markers ?? []).map((marker) =>
          marker.id === activeDrag.id ? { ...marker, x: activeDrag.x, y: activeDrag.y } : marker,
        ),
      };
    }, [activeDrag, content]);
    const worldBounds = locationMapCanvasBounds(layoutContent);
    const viewport = useFreeformCanvasViewport(ref, {
      bounds: {
        x: worldBounds.originX,
        y: worldBounds.originY,
        width: worldBounds.width,
        height: worldBounds.height,
      },
      onAutoPan: adjustDraggedItemForAutoPan,
    });
    const {
      setChildDragging,
      width,
      height,
      localOrigin,
      bakedScale,
      renderWindow,
      scale,
      worldToScreen,
      updateAutoPan,
      stopAutoPan,
      containerRef,
      handleLayout,
      panHandlers,
      animatedTransform,
    } = viewport;

    const updateDrag = useCallback(
      (kind: ActiveDrag['kind'], id: string, x: number, y: number) => {
        const image =
          kind === 'image' ? content.images.find((candidate) => candidate.id === id) : null;
        const point =
          kind === 'image'
            ? image
            : [...content.nodes, ...(content.markers ?? [])].find(
                (candidate) => candidate.id === id,
              );
        if (!point) return;
        const position = {
          x: clampCanvasWorldCoordinate(
            x + dragLocalOriginRef.current.x + dragAutoPanOffsetRef.current.x,
          ),
          y: clampCanvasWorldCoordinate(
            y + dragLocalOriginRef.current.y + dragAutoPanOffsetRef.current.y,
          ),
        };
        pendingDragRef.current = { kind, id, ...position };
        updateAutoPan(
          worldToScreen(
            image
              ? { x: position.x + image.width / 2, y: position.y + image.height / 2 }
              : position,
          ),
        );
        scheduleDrag();
      },
      [content.images, content.markers, content.nodes, scheduleDrag, updateAutoPan, worldToScreen],
    );
    const consumeDrag = useCallback((kind: ActiveDrag['kind'], id: string) => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
      const next = pendingDragRef.current ?? activeDragRef.current;
      pendingDragRef.current = null;
      activeDragRef.current = null;
      setActiveDrag(null);
      return next?.kind === kind && next.id === id ? next : null;
    }, []);
    useEffect(
      () => () => {
        if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      },
      [],
    );
    const handleDragStart = useCallback(() => {
      dragLocalOriginRef.current = localOrigin;
      dragAutoPanOffsetRef.current = { x: 0, y: 0 };
      setChildDragging(true);
    }, [localOrigin, setChildDragging]);
    const handleDragEnd = useCallback(
      (kind: ActiveDrag['kind'], id: string) => {
        stopAutoPan();
        setChildDragging(false);
        const position = consumeDrag(kind, id);
        if (!position) return;
        if (kind === 'image') onMoveImage(id, position.x, position.y);
        else if (kind === 'node') onMoveNode(id, position.x, position.y);
        else onMoveMarker(id, position.x, position.y);
      },
      [consumeDrag, onMoveImage, onMoveMarker, onMoveNode, setChildDragging, stopAutoPan],
    );
    const handleConnectionStart = useCallback(
      (nodeId: string) => {
        const point = [...layoutContent.nodes, ...(layoutContent.markers ?? [])].find(
          (candidate) => candidate.id === nodeId,
        );
        if (point) setConnectionDrag({ fromNodeId: nodeId, x: point.x, y: point.y });
      },
      [layoutContent.markers, layoutContent.nodes],
    );
    const handleConnectionMove = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const point = [...layoutContent.nodes, ...(layoutContent.markers ?? [])].find(
          (candidate) => candidate.id === nodeId,
        );
        if (point) setConnectionDrag({ fromNodeId: nodeId, x: point.x + dx, y: point.y + dy });
      },
      [layoutContent.markers, layoutContent.nodes],
    );
    const handleConnectionEnd = useCallback(
      (nodeId: string, dx: number, dy: number) => {
        const points = [...layoutContent.nodes, ...(layoutContent.markers ?? [])];
        const source = points.find((point) => point.id === nodeId);
        if (!source) return;
        const target = points.find(
          (point) =>
            point.id !== nodeId &&
            Math.hypot(source.x + dx - point.x, source.y + dy - point.y) <=
              LOCATION_MAP_NODE_SIZE / 2,
        );
        setConnectionDrag(null);
        if (target) onConnectPoints(nodeId, target.id);
      },
      [layoutContent.markers, layoutContent.nodes, onConnectPoints],
    );

    const visibleImages = useMemo(
      () =>
        layoutContent.images.filter(
          (image) =>
            image.id === activeDrag?.id ||
            spatialRectIntersects(
              { x: image.x, y: image.y, width: image.width, height: image.height },
              renderWindow,
            ),
        ),
      [activeDrag?.id, layoutContent.images, renderWindow],
    );
    const visiblePoints = useMemo(
      () =>
        [
          ...layoutContent.nodes.map((point, order) => ({ kind: 'node' as const, point, order })),
          ...(layoutContent.markers ?? []).map((point, order) => ({
            kind: 'marker' as const,
            point,
            order: order + layoutContent.nodes.length,
          })),
        ]
          .filter(
            ({ point }) =>
              point.id === activeDrag?.id ||
              spatialRectIntersects(
                {
                  x: point.x - LOCATION_MAP_NODE_SIZE / 2,
                  y: point.y - LOCATION_MAP_NODE_SIZE / 2,
                  width: LOCATION_MAP_NODE_SIZE,
                  height: LOCATION_MAP_NODE_SIZE,
                },
                renderWindow,
              ),
          )
          .sort(
            (left, right) =>
              (left.point.zIndex ?? 0) - (right.point.zIndex ?? 0) || left.order - right.order,
          ),
      [activeDrag?.id, layoutContent.markers, layoutContent.nodes, renderWindow],
    );

    return (
      <GraphCanvasFrame
        width={width}
        height={height}
        contentOverflow="hidden"
        containerRef={containerRef}
        handleLayout={handleLayout}
        panHandlers={panHandlers}
        animatedTransform={animatedTransform}
      >
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
          {visibleImages.map((image) => (
            <LocationMapImageView
              key={image.id}
              image={image}
              uri={imageUris[image.galleryId] ?? null}
              selected={selectedImageId === image.id}
              layoutEditing={layoutEditing}
              scale={scale}
              positionOffsetX={-localOrigin.x}
              positionOffsetY={-localOrigin.y}
              positionScale={bakedScale}
              locked={image.locked}
              onSelect={onSelectImage}
              onMove={(id, x, y) => updateDrag('image', id, x, y)}
              onResize={onResizeImage}
              onDragStart={handleDragStart}
              onDragEnd={(id) => handleDragEnd('image', id)}
              onBringToFront={onBringImageToFront}
              onSendToBack={onSendImageToBack}
              onToggleLock={onToggleImageLock}
              onRemove={onRemoveImage}
            />
          ))}
        </View>
        <LocationMapConnectionLayer
          width={width}
          height={height}
          content={layoutContent}
          connections={connections}
          contains={contains}
          connectionDrag={connectionDrag}
          originX={localOrigin.x}
          originY={localOrigin.y}
          contentScale={bakedScale}
          renderWindow={renderWindow}
          background={colors.background}
          primary={colors.primary}
        />
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 2 }]}>
          {visiblePoints.map(({ kind, point }) => (
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
              positionOffsetX={-localOrigin.x}
              positionOffsetY={-localOrigin.y}
              positionScale={bakedScale}
              onSelect={kind === 'node' ? onSelectNode : onSelectMarker}
              onMove={(id, x, y) => updateDrag(kind, id, x, y)}
              onDragStart={handleDragStart}
              onDragEnd={(id) => handleDragEnd(kind, id)}
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
