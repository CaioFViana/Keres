import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { LocationMapContentType } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import LocationMapCanvas, {
  type LocationMapCanvasHandle,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import LocationMapHeaderActions from '@/src/components/features/location-maps/LocationMapHeaderActions';
import LocationMapConnectionModal from '@/src/components/features/location-maps/LocationMapConnectionModal';
import LocationMapNodeSheet from '@/src/components/features/location-maps/LocationMapNodeSheet';
import LocationMapMarkerSheet from '@/src/components/features/location-maps/LocationMapMarkerSheet';
import LocationMapMarkerConnectionModal from '@/src/components/features/location-maps/LocationMapMarkerConnectionModal';
import LocationMapTools from '@/src/components/features/location-maps/LocationMapTools';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import { useDrizzle } from '../../db';
import type {
  GallerySelect,
  LocationMapSelect,
  LocationRelationSelect,
  LocationSelect,
} from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useLocationMapRelations } from '../../hooks/useLocationMapRelations';
import { useLocationMapCanvasActions } from '../../hooks/useLocationMapCanvasActions';
import { useLocationMapExport } from '../../hooks/useLocationMapExport';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useResolvedMediaUris } from '../../hooks/useResolvedMediaUris';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import { createGalleryService } from '../../services/storymanagement/GalleryService';
import { createLocationMapService } from '../../services/storymanagement/LocationMapService';
import { createLocationRelationService } from '../../services/storymanagement/LocationRelationService';
import { createLocationService } from '../../services/storymanagement/LocationService';
import { useLocationMapDraftStore } from '../../state/locationMapDraftStore';
import { useNotificationStore } from '../../state/notificationStore';
import { readShowcaseRequest } from '../../showcase/showcaseRequest';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { loadBoardEntitySummary, type BoardEntitySummary } from '../../utils/boardEntitySummary';
import { removeLocationMapPoint } from '../../utils/locationMapContent';
const LocationMapScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<LocationStackParamList, 'LocationMap'>>();
  const { mapId } = useRoute<RouteProp<LocationStackParamList, 'LocationMap'>>().params;
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const navigateToEntity = useNavigateToEntityDetail();
  const canvasRef = useRef<LocationMapCanvasHandle>(null);
  const showcaseRequest = readShowcaseRequest();
  const [map, setMap] = useState<LocationMapSelect | null>(null);
  const [content, setContent] = useState<LocationMapContentType>({ images: [], nodes: [] });
  const [savedContent, setSavedContent] = useState<LocationMapContentType>({
    images: [],
    nodes: [],
  });
  const [locations, setLocations] = useState<LocationSelect[]>([]);
  const [galleries, setGalleries] = useState<GallerySelect[]>([]);
  const [relations, setRelations] = useState<LocationRelationSelect[]>([]);
  const [maps, setMaps] = useState<LocationMapSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [openedNodeId, setOpenedNodeId] = useState<string | null>(null);
  const [openedMarkerId, setOpenedMarkerId] = useState<string | null>(null);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionPair, setConnectionPair] = useState<{ from: string; to: string } | null>(null);
  const [markerConnectionPair, setMarkerConnectionPair] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [selectedNodeSummary, setSelectedNodeSummary] = useState<BoardEntitySummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dirty = JSON.stringify(content) !== JSON.stringify(savedContent);
  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.goBack(),
  });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, loadedLocations, loadedGalleries, loadedRelations, loadedMaps] =
        await Promise.all([
          createLocationMapService(db).getById(mapId),
          storyId ? createLocationService(db).getAllByStoryId(storyId) : Promise.resolve([]),
          storyId ? createGalleryService(db).getGalleriesByStoryId(storyId) : Promise.resolve([]),
          storyId
            ? createLocationRelationService(db).getAllRelationsForStory(storyId)
            : Promise.resolve([]),
          storyId ? createLocationMapService(db).getMapsForStory(storyId) : Promise.resolve([]),
        ]);
      if (!row || row.isDeleted) {
        setError(t('location_map_not_found'));
        setMap(null);
        return;
      }
      const draft = useLocationMapDraftStore.getState().draft;
      if (draft && (draft.mapId !== mapId || draft.storyId !== storyId)) {
        useLocationMapDraftStore.getState().clear();
      }
      const keep = useLocationMapDraftStore.getState().draft;
      setMap(row);
      setLocations(loadedLocations.filter((x) => !x.isDeleted));
      setGalleries(loadedGalleries.filter((x) => !x.isDeleted));
      setRelations(loadedRelations.filter((x) => !x.isDeleted));
      setMaps(loadedMaps.filter((x) => !x.isDeleted));
      if (keep && keep.mapId === mapId && keep.storyId === storyId) {
        setContent(keep.content);
        setSavedContent(row.content);
      } else {
        setContent(row.content);
        setSavedContent(row.content);
      }
      setError(null);
    } catch (loadError) {
      console.log('LocationMapScreen: failed to load map.', loadError);
      setError(t('location_map_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [db, mapId, storyId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!storyId || !map || map.id !== mapId) return;
    useLocationMapDraftStore.getState().remember({
      mapId: map.id,
      storyId,
      content,
      savedContent,
    });
  }, [map, mapId, content, savedContent, storyId]);
  // A location map mounts once before its asynchronous document arrives. On a normal opening that
  // leaves the camera at the editing origin; for the website capture, frame the installed example
  // after its pins are present so the screenshot actually documents the canvas.
  useEffect(() => {
    const isLocationMapShowcase =
      showcaseRequest?.stack === 'LocationsStack' && showcaseRequest.screen === 'LocationMapList';
    if (!isLocationMapShowcase || loading || !map || content.nodes.length === 0) return;
    const frame = requestAnimationFrame(() => canvasRef.current?.fitToScreen());
    return () => cancelAnimationFrame(frame);
  }, [content.nodes.length, loading, map, showcaseRequest]);
  const save = useCallback(async () => {
    if (!userId || !map) return;
    try {
      setSaving(true);
      const updated = await createLocationMapService(db).updateMap(userId, map.id, { content });
      setMap(updated);
      setSavedContent(updated.content);
      showNotification(t('location_map_saved'), 'success');
    } catch (saveError) {
      console.log('LocationMapScreen: failed to save map.', saveError);
      showNotification(t('location_map_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [content, db, map, showNotification, t, userId]);
  const revert = useCallback(() => {
    setContent(savedContent);
  }, [savedContent]);
  useScreenHeader({
    target: 'parent',
    title: map?.name ?? t('location_map_list_title'),
    renderActions: useCallback(
      () =>
        canEdit ? (
          <LocationMapHeaderActions
            dirty={dirty}
            saving={saving}
            onRevert={revert}
            onSave={() => void save()}
            layoutEditing={layoutEditing}
            connectionMode={connectionMode}
            onToggleLayout={() => {
              setLayoutEditing((current) => !current);
              setConnectionMode(false);
              setOpenedNodeId(null);
              setOpenedMarkerId(null);
            }}
            onToggleConnectionMode={() => {
              setConnectionMode((current) => !current);
              setLayoutEditing(false);
              setOpenedNodeId(null);
              setOpenedMarkerId(null);
            }}
          />
        ) : null,
      [canEdit, connectionMode, dirty, layoutEditing, revert, save, saving],
    ),
  });
  const galleryMediaById = useMemo(() => {
    const next: Record<
      string,
      {
        mediaType: string;
        mimeType: string;
        localPath: string | null;
        thumbnailPath: string | null;
      }
    > = {};
    for (const gallery of galleries) {
      next[gallery.id] = {
        mediaType: gallery.mediaType,
        mimeType: gallery.mimeType,
        localPath: gallery.localPath,
        thumbnailPath: gallery.thumbnailPath ?? null,
      };
    }
    return next;
  }, [galleries]);
  const imagePaths = useMemo(
    () =>
      content.images.map((image) => {
        const media = galleryMediaById[image.galleryId];
        if (!media || media.mediaType !== 'image') return null;
        return media.localPath;
      }),
    [content.images, galleryMediaById],
  );
  const resolvedUris = useResolvedMediaUris(imagePaths);
  const imageUris = useMemo(() => {
    const next: Record<string, string | null> = {};
    content.images.forEach((image, index) => {
      const path = imagePaths[index];
      next[image.galleryId] = path ? (resolvedUris[path] ?? null) : null;
    });
    return next;
  }, [content.images, imagePaths, resolvedUris]);
  const locationNameById = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );
  const nodeNames = useMemo(() => {
    const next: Record<string, string> = {};
    for (const node of content.nodes)
      next[node.locationId] = locationNameById.get(node.locationId) ?? node.locationId;
    return next;
  }, [content.nodes, locationNameById]);

  const selectedNode = useMemo(
    () => content.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [content.nodes, selectedNodeId],
  );

  useEffect(() => {
    let cancelled = false;
    setSelectedNodeSummary(null);
    if (!selectedNode) return;
    (async () => {
      const summary = await loadBoardEntitySummary(db, 'Location', selectedNode.locationId);
      if (!cancelled) setSelectedNodeSummary(summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, selectedNode]);

  const {
    connections,
    contains,
    nodeConnections,
    nodeParent,
    nodeChildren,
    parentCandidates,
    childCandidates,
    connectCandidates,
    handleAddConnection,
    handleConnectLocations,
    handleRemoveConnection,
    handleSetParent,
    handleSetLocationParent,
    handleRemoveParent,
    handleAddChild,
    handleRemoveRelation,
  } = useLocationMapRelations({
    db,
    storyId,
    userId,
    relations,
    setRelations,
    locations,
    content,
    selectedNode,
    notify: showNotification,
  });

  const handleExport = useLocationMapExport({
    map,
    content,
    galleryMediaById,
    nodeNames,
    connections,
    contains,
    colors,
    t,
    showNotification,
    setExporting,
  });

  const {
    imageOptions,
    locationOptions,
    destinationOptions,
    addImages,
    addLocations,
    addMarker,
    handleResizeImageDirect,
    handleRemoveImage,
    handleToggleImageLock,
    handleSelectImage,
    handleMoveImage,
    handleSelectNode,
    handleMoveNode,
    handleSelectMarker,
    handleMoveMarker,
    moveImageLayer,
    moveNodeLayer,
    moveMarkerLayer,
    destinationName,
    openDestination,
    createDestination,
    handleOpenMarkerDestination,
    handleOpenNodeDestination,
  } = useLocationMapCanvasActions({
    content,
    setContent,
    placementOrigin: () => canvasRef.current?.viewportWorldCenter() ?? { x: 80, y: 80 },
    galleries,
    locations,
    maps,
    mapId,
    galleryMediaById,
    layoutEditing,
    navigation,
    t,
    setSelectedImageId,
    setSelectedNodeId,
    setSelectedMarkerId,
    setOpenedNodeId,
    setOpenedMarkerId,
    db,
    storyId,
    userId,
    setMaps,
    showNotification,
  });

  const openedNode = content.nodes.find((node) => node.id === openedNodeId) ?? null;
  const openedMarker =
    (content.markers ?? []).find((marker) => marker.id === openedMarkerId) ?? null;

  if (loading) return <ScreenLoading message={t('loading')} padded />;
  if (error || !map) {
    return (
      <ScreenError
        message={error || t('location_map_not_found')}
        onGoBack={() => navigation.goBack()}
        padded
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {canEdit && (
        <LocationMapTools
          imageOptions={imageOptions}
          locationOptions={locationOptions}
          onAddImages={addImages}
          onAddLocations={addLocations}
          onAddMarker={addMarker}
        />
      )}
      <LocationMapCanvas
        ref={canvasRef}
        content={content}
        imageUris={imageUris}
        nodeNames={nodeNames}
        connections={connections}
        contains={contains}
        selectedImageId={selectedImageId}
        selectedNodeId={selectedNodeId}
        selectedMarkerId={selectedMarkerId}
        layoutEditing={layoutEditing}
        connectionMode={connectionMode}
        onSelectImage={handleSelectImage}
        onMoveImage={handleMoveImage}
        onResizeImage={handleResizeImageDirect}
        onBringImageToFront={(id) => moveImageLayer(id, 'front')}
        onSendImageToBack={(id) => moveImageLayer(id, 'back')}
        onToggleImageLock={handleToggleImageLock}
        onRemoveImage={handleRemoveImage}
        onBringNodeToFront={(id) => moveNodeLayer(id, 'front')}
        onSendNodeToBack={(id) => moveNodeLayer(id, 'back')}
        onBringMarkerToFront={(id) => moveMarkerLayer(id, 'front')}
        onSendMarkerToBack={(id) => moveMarkerLayer(id, 'back')}
        onSelectNode={handleSelectNode}
        onMoveNode={handleMoveNode}
        onSelectMarker={handleSelectMarker}
        onMoveMarker={handleMoveMarker}
        onOpenNodeDestination={handleOpenNodeDestination}
        onOpenMarkerDestination={handleOpenMarkerDestination}
        onConnectPoints={(from, to) => {
          const fromLocation = content.nodes.find((node) => node.id === from)?.locationId;
          const toLocation = content.nodes.find((node) => node.id === to)?.locationId;
          if (fromLocation && toLocation) setConnectionPair({ from: fromLocation, to: toLocation });
          else setMarkerConnectionPair({ from, to });
        }}
      />
      <GraphCanvasControls
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onExport={() => void handleExport()}
        exporting={exporting}
        exportLabel={t('location_map_export')}
      />
      {openedNode && (
        <LocationMapNodeSheet
          name={nodeNames[openedNode.locationId] ?? openedNode.locationId}
          summary={selectedNodeSummary}
          icon={openedNode.icon}
          color={openedNode.color}
          parent={nodeParent}
          childLocations={nodeChildren}
          connections={nodeConnections}
          parentCandidates={parentCandidates}
          childCandidates={childCandidates}
          connectCandidates={connectCandidates}
          canEdit={canEdit}
          destinationMapId={openedNode.destinationMapId}
          destinationName={destinationName(openedNode.destinationMapId)}
          destinationUnavailable={
            !!openedNode.destinationMapId && !destinationName(openedNode.destinationMapId)
          }
          destinationOptions={destinationOptions}
          onChangeIcon={(icon) =>
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === openedNode.id ? { ...node, icon } : node,
              ),
            }))
          }
          onChangeColor={(color) =>
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === openedNode.id ? { ...node, color } : node,
              ),
            }))
          }
          onSetParent={(locationId) => void handleSetParent(locationId)}
          onRemoveParent={() => void handleRemoveParent()}
          onAddChild={(locationId) => void handleAddChild(locationId)}
          onRemoveRelation={(relationId) => void handleRemoveRelation(relationId)}
          onAddConnection={(locationId) => void handleAddConnection(locationId)}
          onRemoveConnection={(relationId) => void handleRemoveConnection(relationId)}
          onRemoveNode={() => {
            setContent((current) => removeLocationMapPoint(current, openedNode.id));
            setSelectedNodeId(null);
            setOpenedNodeId(null);
          }}
          onChangeDestination={(destinationMapId) =>
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) =>
                node.id === openedNode.id ? { ...node, destinationMapId } : node,
              ),
            }))
          }
          onCreateDestination={() =>
            void createDestination(
              {
                locationId: openedNode.locationId,
                title: nodeNames[openedNode.locationId] ?? openedNode.locationId,
              },
              (destinationMapId) =>
                setContent((current) => ({
                  ...current,
                  nodes: current.nodes.map((node) =>
                    node.id === openedNode.id ? { ...node, destinationMapId } : node,
                  ),
                })),
            )
          }
          onOpenDestination={() => openDestination(openedNode.destinationMapId)}
          onOpenLocation={() => {
            setSelectedNodeId(null);
            navigateToEntity('Location', openedNode.locationId);
          }}
          onClose={() => {
            setOpenedNodeId(null);
            setSelectedNodeId(null);
          }}
        />
      )}
      {openedMarker && (
        <LocationMapMarkerSheet
          title={openedMarker.title}
          note={openedMarker.note}
          icon={openedMarker.icon}
          color={openedMarker.color}
          destinationMapId={openedMarker.destinationMapId}
          destinationUnavailable={
            !!openedMarker.destinationMapId && !destinationName(openedMarker.destinationMapId)
          }
          destinationOptions={destinationOptions}
          canEdit={canEdit}
          onChange={(changes) =>
            setContent((current) => ({
              ...current,
              markers: (current.markers ?? []).map((marker) =>
                marker.id === openedMarker.id ? { ...marker, ...changes } : marker,
              ),
            }))
          }
          onChangeDestination={(destinationMapId) =>
            setContent((current) => ({
              ...current,
              markers: (current.markers ?? []).map((marker) =>
                marker.id === openedMarker.id ? { ...marker, destinationMapId } : marker,
              ),
            }))
          }
          onCreateDestination={() =>
            void createDestination(
              { title: openedMarker.title, note: openedMarker.note },
              (destinationMapId) =>
                setContent((current) => ({
                  ...current,
                  markers: (current.markers ?? []).map((marker) =>
                    marker.id === openedMarker.id ? { ...marker, destinationMapId } : marker,
                  ),
                })),
            )
          }
          onOpenDestination={() => openDestination(openedMarker.destinationMapId)}
          onClearDestination={() =>
            setContent((current) => ({
              ...current,
              markers: (current.markers ?? []).map((marker) =>
                marker.id === openedMarker.id ? { ...marker, destinationMapId: null } : marker,
              ),
            }))
          }
          onRemove={() => {
            setContent((current) => removeLocationMapPoint(current, openedMarker.id));
            setSelectedMarkerId(null);
            setOpenedMarkerId(null);
          }}
          onClose={() => {
            setOpenedMarkerId(null);
            setSelectedMarkerId(null);
          }}
        />
      )}
      {connectionPair && (
        <LocationMapConnectionModal
          pair={connectionPair}
          nodeNames={nodeNames}
          setContent={setContent}
          onConnect={(from, to) => void handleConnectLocations(from, to)}
          onSetParent={(child, parent) => void handleSetLocationParent(child, parent)}
          onClose={() => setConnectionPair(null)}
        />
      )}
      {markerConnectionPair && (
        <LocationMapMarkerConnectionModal
          pair={markerConnectionPair}
          content={content}
          locationNames={nodeNames}
          setContent={setContent}
          onClose={() => setMarkerConnectionPair(null)}
        />
      )}
    </View>
  );
};

export default LocationMapScreen;
