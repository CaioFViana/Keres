import type { LocationMapContentType } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { useDrizzle } from '../db';
import type { GallerySelect, LocationMapSelect, LocationSelect } from '../db/schema';
import type { LocationStackParamList } from '../navigation/MainSystemStack';
import { createLocationMapService } from '../services/storymanagement/LocationMapService';
import type { NotificationType } from '../state/notificationStore';
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
} from '../utils/locationMapContent';
import { imageSizeOf } from '../utils/locationMapMedia';

type GalleryMediaById = Record<
  string,
  {
    mediaType: string;
    mimeType: string;
    localPath: string | null;
    thumbnailPath: string | null;
  }
>;

interface UseLocationMapCanvasActionsOptions {
  content: LocationMapContentType;
  setContent: Dispatch<SetStateAction<LocationMapContentType>>;
  galleries: GallerySelect[];
  locations: LocationSelect[];
  maps: LocationMapSelect[];
  mapId: string;
  galleryMediaById: GalleryMediaById;
  layoutEditing: boolean;
  navigation: NativeStackNavigationProp<LocationStackParamList, 'LocationMap'>;
  t: TFunction;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setSelectedMarkerId: Dispatch<SetStateAction<string | null>>;
  setOpenedNodeId: Dispatch<SetStateAction<string | null>>;
  setOpenedMarkerId: Dispatch<SetStateAction<string | null>>;
  db: ReturnType<typeof useDrizzle>;
  storyId: string | undefined;
  userId: string | null | undefined;
  setMaps: Dispatch<SetStateAction<LocationMapSelect[]>>;
  showNotification: (message: string, type?: NotificationType) => void;
}

/** Keeps canvas-specific selection, layout, and destination actions out of the screen component. */
export function useLocationMapCanvasActions({
  content,
  setContent,
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
}: UseLocationMapCanvasActionsOptions) {
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
  const addImages = useCallback(
    async (values: string[]) => {
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
    },
    [galleryMediaById, setContent],
  );
  const addLocations = useCallback(
    (values: string[]) => setContent((current) => appendLocationsToMap(current, values)),
    [setContent],
  );
  const addMarker = useCallback(
    () =>
      setContent((current) =>
        appendMarkersToMap(current, [{ title: t('location_map_marker_default_title') }]),
      ),
    [setContent, t],
  );
  const handleResizeImageDirect = useCallback(
    (imageId: string, width: number, height: number) => {
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
    },
    [setContent],
  );
  const handleRemoveImage = useCallback(
    (imageId: string) => {
      setContent((current) => ({
        ...current,
        images: current.images.filter((image) => image.id !== imageId),
      }));
      setSelectedImageId(null);
    },
    [setContent, setSelectedImageId],
  );
  const handleToggleImageLock = useCallback(
    (imageId: string) =>
      setContent((current) => ({
        ...current,
        images: current.images.map((image) =>
          image.id === imageId ? { ...image, locked: !image.locked } : image,
        ),
      })),
    [setContent],
  );
  const handleSelectImage = useCallback(
    (imageId: string) => {
      setSelectedNodeId(null);
      setSelectedMarkerId(null);
      setSelectedImageId(imageId);
      setOpenedNodeId(null);
    },
    [setOpenedNodeId, setSelectedImageId, setSelectedMarkerId, setSelectedNodeId],
  );
  const handleMoveImage = useCallback(
    (imageId: string, x: number, y: number) =>
      setContent((current) => ({
        ...current,
        images: current.images.map((image) => (image.id === imageId ? { ...image, x, y } : image)),
      })),
    [setContent],
  );
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedImageId(null);
      setSelectedMarkerId(null);
      setSelectedNodeId(nodeId);
      if (!layoutEditing) setOpenedNodeId(nodeId);
    },
    [layoutEditing, setOpenedNodeId, setSelectedImageId, setSelectedMarkerId, setSelectedNodeId],
  );
  const handleMoveNode = useCallback(
    (nodeId: string, x: number, y: number) =>
      setContent((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
      })),
    [setContent],
  );
  const handleSelectMarker = useCallback(
    (markerId: string) => {
      setSelectedImageId(null);
      setSelectedNodeId(null);
      setSelectedMarkerId(markerId);
      setOpenedNodeId(null);
      if (!layoutEditing) setOpenedMarkerId(markerId);
    },
    [layoutEditing, setOpenedMarkerId, setOpenedNodeId, setSelectedImageId, setSelectedMarkerId, setSelectedNodeId],
  );
  const handleMoveMarker = useCallback(
    (markerId: string, x: number, y: number) =>
      setContent((current) => ({
        ...current,
        markers: (current.markers ?? []).map((marker) =>
          marker.id === markerId ? { ...marker, x, y } : marker,
        ),
      })),
    [setContent],
  );
  const moveImageLayer = useCallback(
    (imageId: string, direction: 'front' | 'back') =>
      setContent((current) => {
        const levels = current.images.map((image) => image.zIndex ?? 0);
        const zIndex = direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
        return {
          ...current,
          images: current.images.map((image) => (image.id === imageId ? { ...image, zIndex } : image)),
        };
      }),
    [setContent],
  );
  const moveNodeLayer = useCallback(
    (nodeId: string, direction: 'front' | 'back') =>
      setContent((current) => {
        const levels = current.nodes.map((node) => node.zIndex ?? 0);
        levels.push(...(current.markers ?? []).map((marker) => marker.zIndex ?? 0));
        const zIndex = direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
        return {
          ...current,
          nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, zIndex } : node)),
        };
      }),
    [setContent],
  );
  const moveMarkerLayer = useCallback(
    (markerId: string, direction: 'front' | 'back') =>
      setContent((current) => {
        const levels = [
          ...current.nodes.map((node) => node.zIndex ?? 0),
          ...(current.markers ?? []).map((marker) => marker.zIndex ?? 0),
        ];
        const zIndex = direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
        return {
          ...current,
          markers: (current.markers ?? []).map((marker) =>
            marker.id === markerId ? { ...marker, zIndex } : marker,
          ),
        };
      }),
    [setContent],
  );
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
    [maps, navigation, setOpenedMarkerId, setOpenedNodeId],
  );
  const handleOpenMarkerDestination = useCallback(
    (markerId: string) => {
      const marker = (content.markers ?? []).find((candidate) => candidate.id === markerId);
      if (!marker?.destinationMapId || !maps.some((candidate) => candidate.id === marker.destinationMapId)) {
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
      if (!node?.destinationMapId || !maps.some((candidate) => candidate.id === node.destinationMapId)) {
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
          : appendMarkersToMap({ images: [], nodes: [] }, [{ title: source.title, note: source.note }]);
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
    [db, showNotification, storyId, t, userId, setMaps],
  );

  return {
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
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
