import { Ionicons } from '@expo/vector-icons';
import type { LocationMapContentType } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import LocationMapCanvas, {
  type LocationMapCanvasHandle,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import LocationMapImageSheet from '@/src/components/features/location-maps/LocationMapImageSheet';
import LocationMapNodeSheet from '@/src/components/features/location-maps/LocationMapNodeSheet';
import GraphCanvasControls from '@/src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import { useDrizzle } from '../../db';
import type { GallerySelect, LocationMapSelect, LocationRelationSelect, LocationSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useLocationMapRelations } from '../../hooks/useLocationMapRelations';
import { useResolvedMediaUris } from '../../hooks/useResolvedMediaUris';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { LocationStackParamList } from '../../navigation/MainSystemStack';
import { mediaFileService } from '../../services/MediaFileService';
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
} from '../../utils/locationMapLayout';
import { appendImagesToMap, appendLocationsToMap } from '../../utils/locationMapContent';
import { bytesToBase64, imageSizeOf } from '../../utils/locationMapMedia';
import { renderLocationMapSvg } from '../../utils/locationMapSvg';
import { buildLocationMapFileName, deliverSvgMap } from '../../utils/storyTransfer';
import { setDocumentTitle } from '../../utils/documentTitle';

const LocationMapScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<LocationStackParamList, 'LocationMap'>>();
  const { mapId } = useRoute<RouteProp<LocationStackParamList, 'LocationMap'>>().params;
  const db = useDrizzle();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit } = useStoryRole(storyId);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const canvasRef = useRef<LocationMapCanvasHandle>(null);

  const [map, setMap] = useState<LocationMapSelect | null>(null);
  const [content, setContent] = useState<LocationMapContentType>({ images: [], nodes: [] });
  const [savedContent, setSavedContent] = useState<LocationMapContentType>({ images: [], nodes: [] });
  const [locations, setLocations] = useState<LocationSelect[]>([]);
  const [galleries, setGalleries] = useState<GallerySelect[]>([]);
  const [relations, setRelations] = useState<LocationRelationSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
      const [row, loadedLocations, loadedGalleries, loadedRelations] = await Promise.all([
        createLocationMapService(db).getById(mapId),
        storyId ? createLocationService(db).getAllByStoryId(storyId) : Promise.resolve([]),
        storyId ? createGalleryService(db).getGalleriesByStoryId(storyId) : Promise.resolve([]),
        storyId
          ? createLocationRelationService(db).getAllRelationsForStory(storyId)
          : Promise.resolve([]),
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
              <View style={{ flexDirection: 'row', marginRight: 12, gap: 14 }}>
                <TouchableOpacity
                  onPress={revert}
                  disabled={!dirty}
                  accessibilityLabel={t('board_revert')}
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={24}
                    color={dirty ? colors.text : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void save()}
                  disabled={!dirty || saving}
                  accessibilityLabel={t('board_save')}
                >
                  <Ionicons
                    name="checkmark-outline"
                    size={26}
                    color={dirty ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            )
          : undefined,
      });
    }, [
      canEdit,
      colors.primary,
      colors.text,
      colors.textSecondary,
      dirty,
      map?.name,
      navigation,
      revert,
      save,
      saving,
      t,
    ]),
  );

  const galleryMediaById = useMemo(() => {
    const next: Record<
      string,
      { mediaType: string; mimeType: string; localPath: string | null; thumbnailPath: string | null }
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
    for (const node of content.nodes) next[node.locationId] = locationNameById.get(node.locationId) ?? node.locationId;
    return next;
  }, [content.nodes, locationNameById]);

  const selectedNode = useMemo(
    () => content.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [content.nodes, selectedNodeId],
  );

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
      const imageUris: Record<string, string> = {};
      for (const image of content.images) {
        const media = galleryMediaById[image.galleryId];
        const path = media?.mediaType === 'image' ? media.localPath : null;
        if (!path) continue;
        try {
          const bytes = await mediaFileService.readBytes(path);
          imageUris[image.galleryId] = `data:${media.mimeType || 'image/jpeg'};base64,${bytesToBase64(bytes)}`;
        } catch (readError) {
          console.log('LocationMapScreen: failed to read image for export.', readError);
        }
      }

      const svg = renderLocationMapSvg(content, {
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
        imageUris,
      });
      const result = await deliverSvgMap(svg, buildLocationMapFileName(map.name));
      if (result.delivered) {
        showNotification(t('location_map_export_success', { fileName: result.fileName }), 'success');
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
  }, [colors, connections, contains, content, galleryMediaById, map, nodeNames, showNotification, t]);

  const usedGalleryIds = useMemo(() => new Set(content.images.map((image) => image.galleryId)), [content.images]);
  const imageOptions = useMemo(
    () =>
      galleries
        .filter((gallery) => gallery.mediaType === 'image' && !!gallery.localPath && !usedGalleryIds.has(gallery.id))
        .map((gallery) => ({ label: gallery.title || gallery.fileName, value: gallery.id })),
    [galleries, usedGalleryIds],
  );

  const usedLocationIds = useMemo(() => new Set(content.nodes.map((node) => node.locationId)), [content.nodes]);
  const locationOptions = useMemo(
    () =>
      locations
        .filter((location) => !usedLocationIds.has(location.id))
        .map((location) => ({ label: location.name, value: location.id })),
    [locations, usedLocationIds],
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

  const selectedImage = useMemo(
    () => content.images.find((image) => image.id === selectedImageId) ?? null,
    [content.images, selectedImageId],
  );

  const handleResizeImage = useCallback(
    (factor: number) => {
      if (!selectedImageId) return;
      setContent((current) => ({
        ...current,
        images: current.images.map((image) =>
          image.id === selectedImageId
            ? {
                ...image,
                width: clamp(image.width * factor, LOCATION_MAP_IMAGE_MIN, LOCATION_MAP_IMAGE_MAX),
                height: clamp(image.height * factor, LOCATION_MAP_IMAGE_MIN, LOCATION_MAP_IMAGE_MAX),
              }
            : image,
        ),
      }));
    },
    [selectedImageId],
  );

  const handleRemoveImage = useCallback(() => {
    if (!selectedImageId) return;
    setContent((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== selectedImageId),
    }));
    setSelectedImageId(null);
  }, [selectedImageId]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tools: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
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
        <View style={styles.tools}>
          <MultiSelectPill
            options={imageOptions}
            selectedValues={[]}
            onSelectionChange={(values) => {
              addImages(values);
            }}
            placeholder={t('location_map_add_images')}
            noOptionsText={t('location_map_no_images')}
            searchPlaceholder={t('search')}
          />
          <MultiSelectPill
            options={locationOptions}
            selectedValues={[]}
            onSelectionChange={(values) => addLocations(values)}
            placeholder={t('location_map_add_locations')}
            noOptionsText={t('location_map_no_locations')}
            searchPlaceholder={t('search')}
          />
        </View>
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
        onSelectImage={(imageId) => {
          setSelectedNodeId(null);
          setSelectedImageId(imageId);
        }}
        onMoveImage={(imageId, x, y) =>
          setContent((current) => ({
            ...current,
            images: current.images.map((image) => (image.id === imageId ? { ...image, x, y } : image)),
          }))
        }
        onSelectNode={(nodeId) => {
          setSelectedImageId(null);
          setSelectedNodeId(nodeId);
        }}
        onMoveNode={(nodeId, x, y) =>
          setContent((current) => ({
            ...current,
            nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
          }))
        }
      />
      <GraphCanvasControls
        onZoomIn={() => canvasRef.current?.zoomBy(1.25)}
        onZoomOut={() => canvasRef.current?.zoomBy(0.8)}
        onFit={() => canvasRef.current?.fitToScreen()}
        onExport={() => void handleExport()}
        exporting={exporting}
        exportLabel={t('location_map_export')}
      />
      {selectedImage && (
        <LocationMapImageSheet
          visible
          onClose={() => setSelectedImageId(null)}
          onResize={handleResizeImage}
          onRemove={handleRemoveImage}
        />
      )}
      {selectedNode && (
        <LocationMapNodeSheet
          name={nodeNames[selectedNode.locationId] ?? selectedNode.locationId}
          icon={selectedNode.icon}
          color={selectedNode.color}
          parent={nodeParent}
          childLocations={nodeChildren}
          connections={nodeConnections}
          parentCandidates={parentCandidates}
          childCandidates={childCandidates}
          connectCandidates={connectCandidates}
          canEdit={canEdit}
          onChangeIcon={(icon) =>
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, icon } : node)),
            }))
          }
          onChangeColor={(color) =>
            setContent((current) => ({
              ...current,
              nodes: current.nodes.map((node) => (node.id === selectedNode.id ? { ...node, color } : node)),
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
              nodes: current.nodes.filter((node) => node.id !== selectedNode.id),
            }));
            setSelectedNodeId(null);
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </View>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default LocationMapScreen;