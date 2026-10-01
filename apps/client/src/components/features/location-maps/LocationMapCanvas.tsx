import {
  canvasOverlayBounds,
  spatialRectIntersects,
  type CanvasOverlayType,
  type LocationMapContentType,
} from '@keres/shared';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import CanvasStampView from '@/src/components/features/graphs/CanvasOverlay/CanvasStampView';
import OverlayInteractionLayer from '@/src/components/features/graphs/CanvasOverlay/OverlayInteractionLayer';
import OverlaySelectionView from '@/src/components/features/graphs/CanvasOverlay/OverlaySelectionView';
import type {
  OverlayCanvasCallbacks,
  OverlayDraft,
  OverlayInteractionMode,
} from '@/src/components/features/graphs/CanvasOverlay/overlayTools';
import GraphCanvasFrame, {
  graphCanvasPlaneStyle,
} from '@/src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame';
import { type CanvasViewportHandle, useCanvasViewport } from '@/src/hooks/useCanvasViewport';
import {
  locationMapCanvasBounds,
  LOCATION_MAP_NODE_SIZE,
} from '@keres/shared/graphs/locationMapLayout';
import { useTheme } from '../../../theme';
import { clampCanvasWorldCoordinate } from '../../../utils/canvasDragBounds';
import SkiaOverlayErrorBoundary from '../graphs/SkiaEdgeCanvas/SkiaOverlayErrorBoundary';
import LocationMapConnectionLayer, {
  type LocationMapConnection,
  type LocationMapContains,
} from './LocationMapConnectionLayer';
import TrajectoryOffMapChip from './TrajectoryOffMapChip';
import LocationMapImageView from './LocationMapImageView';
import LocationMapNodeView from './LocationMapNodeView';

export type LocationMapCanvasHandle = CanvasViewportHandle;
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
  /** While set, images and points ignore taps and drags: only overlay shapes respond. */
  overlayEditing: boolean;
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
  interactionMode: OverlayInteractionMode;
  draft: OverlayDraft | null;
  selectedOverlayId: string | null;
  overlayCallbacks: OverlayCanvasCallbacks;
  /** Transient trajectory lines; rendered but never persisted into the content. */
  trajectoryOverlays: CanvasOverlayType[] | null;
  offMapCount: number;
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
      overlayEditing,
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
      interactionMode,
      draft,
      selectedOverlayId,
      overlayCallbacks,
      trajectoryOverlays,
      offMapCount,
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
    const viewport = useCanvasViewport(
      ref,
      {
        x: worldBounds.originX,
        y: worldBounds.originY,
        width: worldBounds.width,
        height: worldBounds.height,
      },
      { clampMode: 'none', onAutoPan: adjustDraggedItemForAutoPan },
    );
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
          x: clampCanvasWorldCoordinate(x + dragAutoPanOffsetRef.current.x),
          y: clampCanvasWorldCoordinate(y + dragAutoPanOffsetRef.current.y),
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
      dragAutoPanOffsetRef.current = { x: 0, y: 0 };
      setChildDragging(true);
    }, [setChildDragging]);
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
    const visibleStamps = useMemo(
      () =>
        (layoutContent.overlays ?? [])
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
      [layoutContent.overlays, renderWindow],
    );
    const snapTargets = useMemo(
      () =>
        [...layoutContent.nodes, ...(layoutContent.markers ?? [])].map((point) => ({
          x: point.x,
          y: point.y,
        })),
      [layoutContent.markers, layoutContent.nodes],
    );
    const selectedOverlay = selectedOverlayId
      ? ((layoutContent.overlays ?? []).find((overlay) => overlay.id === selectedOverlayId) ?? null)
      : null;

    // Paint order stays images < edges < nodes: the image bases ride their own camera
    // plane below the overlay, the pins stay on the main plane above it.
    const underlay = (
      <Animated.View
        style={[graphCanvasPlaneStyle, { transform: animatedTransform }]}
        pointerEvents="box-none"
      >
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
          {visibleImages.map((image) => (
            <LocationMapImageView
              key={image.id}
              image={image}
              uri={imageUris[image.galleryId] ?? null}
              selected={selectedImageId === image.id}
              layoutEditing={layoutEditing}
              overlayEditing={overlayEditing}
              scale={scale}
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
      </Animated.View>
    );
    const overlay =
      width > 0 && height > 0 ? (
        <SkiaOverlayErrorBoundary canvas="location-map">
          <LocationMapConnectionLayer
            content={layoutContent}
            connections={connections}
            contains={contains}
            overlays={[...(layoutContent.overlays ?? []), ...(trajectoryOverlays ?? [])]}
            draft={draft}
            rectPreview={rectPreview}
            scale={scale}
            connectionDrag={connectionDrag}
            camera={cameraTransform}
            renderWindow={renderWindow}
            background={colors.background}
            primary={colors.primary}
          />
        </SkiaOverlayErrorBoundary>
      ) : null;

    return (
      <View style={{ flex: 1 }}>
        <GraphCanvasFrame
          containerRef={containerRef}
          handleLayout={handleLayout}
          panHandlers={panHandlers}
          animatedTransform={animatedTransform}
          underlay={underlay}
          overlay={overlay}
          interactionOverlay={
            interactionMode ? (
              <OverlayInteractionLayer
                mode={interactionMode}
                screenToWorld={screenToWorld}
                scale={scale}
                overlays={layoutContent.overlays}
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
                overlayEditing={overlayEditing}
                scale={scale}
                onSelect={kind === 'node' ? onSelectNode : onSelectMarker}
                onMove={(id, x, y) => updateDrag(kind, id, x, y)}
                onDragStart={handleDragStart}
                onDragEnd={(id) => handleDragEnd(kind, id)}
                onBringToFront={kind === 'node' ? onBringNodeToFront : onBringMarkerToFront}
                onSendToBack={kind === 'node' ? onSendNodeToBack : onSendMarkerToBack}
                onOpenDestination={
                  kind === 'node' ? onOpenNodeDestination : onOpenMarkerDestination
                }
                onConnectionStart={handleConnectionStart}
                onConnectionMove={handleConnectionMove}
                onConnectionEnd={handleConnectionEnd}
                onConnectionCancel={() => setConnectionDrag(null)}
              />
            ))}
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
          </View>
        </GraphCanvasFrame>
        <TrajectoryOffMapChip count={offMapCount} />
      </View>
    );
  },
);

LocationMapCanvas.displayName = 'LocationMapCanvas';

export default LocationMapCanvas;
