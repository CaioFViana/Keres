import type { LocationMapContentType } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import LocationMapCanvas, {
  type LocationMapCanvasHandle,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import LocationMapHeaderActions from '@/src/components/features/location-maps/LocationMapHeaderActions';
import LocationMapNodeSheet from '@/src/components/features/location-maps/LocationMapNodeSheet';
import LocationMapMarkerSheet from '@/src/components/features/location-maps/LocationMapMarkerSheet';
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
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  LOCATION_MAP_IMAGE_DEFAULT_HEIGHT,
  LOCATION_MAP_IMAGE_DEFAULT_WIDTH,
  LOCATION_MAP_IMAGE_MAX,
  LOCATION_MAP_IMAGE_MIN,
} from '@keres/shared/graphs/locationMapLayout';
import {
  appendImagesToMap,
  appendLocationsToMap,
  appendMarkersToMap,
} from '../../utils/locationMapContent';
import { imageSizeOf } from '../../utils/locationMapMedia';
import { buildLocationMapSvg } from '../../utils/locationMapExport';
import { buildLocationMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { setDocumentTitle } from '../../utils/documentTitle';
import { loadBoardEntitySummary, type BoardEntitySummary } from '../../utils/boardEntitySummary';

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

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(map?.name ?? t('location_map_list_title'));
      navigation.getParent()?.setOptions({
        title: map?.name ?? t('location_map_list_title'),
        headerRight: canEdit
          ? () => (
              <LocationMapHeaderActions
                dirty={dirty}
                saving={saving}
                onRevert={revert}
                onSave={() => void save()}
                layoutEditing={layoutEditing}
                onToggleLayout={() => {
                  setLayoutEditing((current) => !current);
                  setOpenedNodeId(null);
                  setOpenedMarkerId(null);
                }}
              />
            )
          : undefined,
      });
    }, [canEdit, dirty, layoutEditing, map?.name, navigation, revert, save, saving, t]),
  );

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
    handleRemoveConnection,
    handleSetParent,
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

  const handleExport = useCallback(async () => {
    if (!map) return;
    setExporting(true);
    try {
      // The exported SVG is standalone, so each image base is embedded as a data URI. Only the
      // images actually used on the map are read.
      const svg = await buildLocationMapSvg(content, galleryMediaById, {
        title: map.name,
        subtitle: t('location_map_export_subtitle', {
          nodeCount: content.nodes.length,
          imageCount: content.images.length,
        }),
        colors: {
          background: colors.background,
          surface: colors.surface,
          text: colors.text,
          textSecondary: colors.textSecondary,
          border: colors.border,
        },
        nodeNames,
        connections,
        contains,
      });
      const result = await deliverSvgMap(svg, buildLocationMapFileName(map.name));
      if (result.delivered) {
        showNotification(
          t('location_map_export_success', { fileName: result.fileName }),
          'success',
        );
      } else {
        showNotification(
          t('location_map_export_no_share_target', { path: result.uri ?? result.fileName }),
          'warning',
        );
      }
    } catch (exportError) {
      console.log('LocationMapScreen: failed to export map.', exportError);
      showNotification(t('location_map_export_failed'), 'error');
    } finally {
      setExporting(false);
    }
  }, [
    colors,
    connections,
    contains,
    content,
    galleryMediaById,
    map,
    nodeNames,
    showNotification,
    t,
  ]);

  const usedGalleryIds = useMemo(
    () => new Set(content.images.map((image) => image.galleryId)),
    [content.images],
  );
  const imageOptions = useMemo(
    () =>
      galleries
        .filter(
          (gallery) =>
            gallery.mediaType === 'image' && !!gallery.localPath && !usedGalleryIds.has(gallery.id),
        )
        .map((gallery) => ({ label: gallery.title || gallery.fileName, value: gallery.id })),
    [galleries, usedGalleryIds],
  );

  const usedLocationIds = useMemo(
    () => new Set(content.nodes.map((node) => node.locationId)),
    [content.nodes],
  );
  const locationOptions = useMemo(
    () =>
      locations
        .filter((location) => !usedLocationIds.has(location.id))
        .map((location) => ({ label: location.name, value: location.id })),
    [locations, usedLocationIds],
  );
  const destinationOptions = useMemo(
    () =>
      maps
        .filter((candidate) => candidate.id !== mapId)
        .map((candidate) => ({ label: candidate.name, value: candidate.id })),
    [mapId, maps],
  );

  const addImages = async (values: string[]) => {
    // Each image keeps its real aspect ratio: the default size is a bounding box the image is
    // scaled to fit, so a square picture comes in square instead of stretched rectangular.
    const sized: { galleryId: string; width: number; height: number }[] = [];
    for (const galleryId of values) {
      const media = galleryMediaById[galleryId];
      let width = LOCATION_MAP_IMAGE_DEFAULT_WIDTH;
      let height = LOCATION_MAP_IMAGE_DEFAULT_HEIGHT;
      if (media?.localPath) {
        try {
          const { width: naturalWidth, height: naturalHeight } = await imageSizeOf(media.localPath);
          if (naturalWidth > 0 && naturalHeight > 0) {
            const scale = Math.min(
              LOCATION_MAP_IMAGE_DEFAULT_WIDTH / naturalWidth,
              LOCATION_MAP_IMAGE_DEFAULT_HEIGHT / naturalHeight,
            );
            width = Math.max(LOCATION_MAP_IMAGE_MIN, Math.round(naturalWidth * scale));
            height = Math.max(LOCATION_MAP_IMAGE_MIN, Math.round(naturalHeight * scale));
          }
        } catch (sizeError) {
          console.log('LocationMapScreen: failed to read image size, using default.', sizeError);
        }
      }
      sized.push({ galleryId, width, height });
    }

    setContent((current) => appendImagesToMap(current, sized));
  };

  const addLocations = (values: string[]) => {
    setContent((current) => appendLocationsToMap(current, values));
  };
  const addMarker = () => {
    setContent((current) =>
      appendMarkersToMap(current, [{ title: t('location_map_marker_default_title') }]),
    );
  };

  const openedNode = useMemo(
    () => content.nodes.find((node) => node.id === openedNodeId) ?? null,
    [content.nodes, openedNodeId],
  );
  const openedMarker = useMemo(
    () => (content.markers ?? []).find((marker) => marker.id === openedMarkerId) ?? null,
    [content.markers, openedMarkerId],
  );

  const handleResizeImageDirect = useCallback((imageId: string, width: number, height: number) => {
    setContent((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId
          ? {
              ...image,
              width: clamp(width, LOCATION_MAP_IMAGE_MIN, LOCATION_MAP_IMAGE_MAX),
              height: clamp(height, LOCATION_MAP_IMAGE_MIN, LOCATION_MAP_IMAGE_MAX),
            }
          : image,
      ),
    }));
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    setContent((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
    setSelectedImageId(null);
  }, []);

  const handleToggleImageLock = useCallback((imageId: string) => {
    setContent((current) => ({
      ...current,
      images: current.images.map((image) =>
        image.id === imageId ? { ...image, locked: !image.locked } : image,
      ),
    }));
  }, []);

  const handleSelectImage = useCallback((imageId: string) => {
    setSelectedNodeId(null);
    setSelectedMarkerId(null);
    setSelectedImageId(imageId);
    setOpenedNodeId(null);
  }, []);

  const handleMoveImage = useCallback((imageId: string, x: number, y: number) => {
    setContent((current) => ({
      ...current,
      images: current.images.map((image) => (image.id === imageId ? { ...image, x, y } : image)),
    }));
  }, []);

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedImageId(null);
      setSelectedMarkerId(null);
      setSelectedNodeId(nodeId);
      if (!layoutEditing) setOpenedNodeId(nodeId);
    },
    [layoutEditing],
  );

  const handleMoveNode = useCallback((nodeId: string, x: number, y: number) => {
    setContent((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
    }));
  }, []);
  const handleSelectMarker = useCallback(
    (markerId: string) => {
      setSelectedImageId(null);
      setSelectedNodeId(null);
      setSelectedMarkerId(markerId);
      setOpenedNodeId(null);
      if (!layoutEditing) setOpenedMarkerId(markerId);
    },
    [layoutEditing],
  );
  const handleMoveMarker = useCallback((markerId: string, x: number, y: number) => {
    setContent((current) => ({
      ...current,
      markers: (current.markers ?? []).map((marker) =>
        marker.id === markerId ? { ...marker, x, y } : marker,
      ),
    }));
  }, []);

  const moveImageLayer = useCallback((imageId: string, direction: 'front' | 'back') => {
    setContent((current) => {
      const levels = current.images.map((image) => image.zIndex ?? 0);
      const zIndex =
        direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
      return {
        ...current,
        images: current.images.map((image) =>
          image.id === imageId ? { ...image, zIndex } : image,
        ),
      };
    });
  }, []);

  const moveNodeLayer = useCallback((nodeId: string, direction: 'front' | 'back') => {
    setContent((current) => {
      const levels = current.nodes.map((node) => node.zIndex ?? 0);
      levels.push(...(current.markers ?? []).map((marker) => marker.zIndex ?? 0));
      const zIndex =
        direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
      return {
        ...current,
        nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, zIndex } : node)),
      };
    });
  }, []);
  const moveMarkerLayer = useCallback((markerId: string, direction: 'front' | 'back') => {
    setContent((current) => {
      const levels = [
        ...current.nodes.map((node) => node.zIndex ?? 0),
        ...(current.markers ?? []).map((marker) => marker.zIndex ?? 0),
      ];
      const zIndex =
        direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
      return {
        ...current,
        markers: (current.markers ?? []).map((marker) =>
          marker.id === markerId ? { ...marker, zIndex } : marker,
        ),
      };
    });
  }, []);

  const destinationName = useCallback(
    (destinationMapId?: string | null) =>
      maps.find((candidate) => candidate.id === destinationMapId)?.name ?? null,
    [maps],
  );
  const openDestination = useCallback(
    (destinationMapId?: string | null) => {
      if (!destinationMapId || !maps.some((candidate) => candidate.id === destinationMapId)) return;
      setOpenedNodeId(null);
      setOpenedMarkerId(null);
      navigation.navigate('LocationMap', { mapId: destinationMapId });
    },
    [maps, navigation],
  );
  const handleOpenMarkerDestination = useCallback(
    (markerId: string) => {
      const marker = (content.markers ?? []).find((candidate) => candidate.id === markerId);
      if (
        !marker?.destinationMapId ||
        !maps.some((candidate) => candidate.id === marker.destinationMapId)
      ) {
        handleSelectMarker(markerId);
        return;
      }
      openDestination(marker.destinationMapId);
    },
    [content.markers, handleSelectMarker, maps, openDestination],
  );
  const handleOpenNodeDestination = useCallback(
    (nodeId: string) => {
      const node = content.nodes.find((candidate) => candidate.id === nodeId);
      if (
        !node?.destinationMapId ||
        !maps.some((candidate) => candidate.id === node.destinationMapId)
      ) {
        handleSelectNode(nodeId);
        return;
      }
      openDestination(node.destinationMapId);
    },
    [content.nodes, handleSelectNode, maps, openDestination],
  );
  const createDestination = useCallback(
    async (
      source: { locationId?: string; title: string; note?: string | null },
      setDestination: (mapId: string) => void,
    ) => {
      if (!storyId || !userId) return;
      try {
        const initial = source.locationId
          ? appendLocationsToMap({ images: [], nodes: [] }, [source.locationId])
          : appendMarkersToMap({ images: [], nodes: [] }, [
              { title: source.title, note: source.note },
            ]);
        const created = await createLocationMapService(db).createMap(userId, {
          storyId,
          name: `${source.title} — ${t('location_map_destination')}`,
          description: null,
          content: initial,
        });
        setMaps((current) => [...current, created]);
        setDestination(created.id);
        showNotification(t('location_map_destination_created'), 'success');
      } catch (createError) {
        console.log('LocationMapScreen: failed to create destination map.', createError);
        showNotification(t('location_map_save_failed'), 'error');
      }
    },
    [db, showNotification, storyId, t, userId],
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
  });

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
    <View style={styles.container}>
      {canEdit && (
        <LocationMapTools
          imageOptions={imageOptions}
          locationOptions={locationOptions}
          onAddImages={(values) => {
            addImages(values);
          }}
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
            setContent((current) => ({
              ...current,
              nodes: current.nodes.filter((node) => node.id !== openedNode.id),
            }));
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
            setContent((current) => ({
              ...current,
              markers: (current.markers ?? []).filter((marker) => marker.id !== openedMarker.id),
            }));
            setSelectedMarkerId(null);
            setOpenedMarkerId(null);
          }}
          onClose={() => {
            setOpenedMarkerId(null);
            setSelectedMarkerId(null);
          }}
        />
      )}
    </View>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default LocationMapScreen;
