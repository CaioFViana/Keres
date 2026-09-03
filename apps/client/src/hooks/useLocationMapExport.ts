import type { LocationMapContentType } from '@keres/shared';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type {
  LocationMapConnection,
  LocationMapContains,
} from '@/src/components/features/location-maps/LocationMapCanvas';
import type { LocationMapSelect } from '../db/schema';
import type { NotificationType } from '../state/notificationStore';
import { buildLocationMapFileName, deliverSvgMap } from '../utils/storyTransfer';
import { buildStandaloneLocationMapSvg } from '../utils/storyMapSvgExport';

type GalleryMediaById = Record<
  string,
  {
    mediaType: string;
    mimeType: string;
    localPath: string | null;
    thumbnailPath: string | null;
  }
>;

interface Options {
  map: LocationMapSelect | null;
  content: LocationMapContentType;
  galleryMediaById: GalleryMediaById;
  nodeNames: Record<string, string>;
  connections: LocationMapConnection[];
  contains: LocationMapContains[];
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  t: TFunction;
  showNotification: (message: string, type?: NotificationType) => void;
  setExporting: Dispatch<SetStateAction<boolean>>;
}

/** Builds and delivers a standalone location-map SVG without inflating its screen controller. */
export function useLocationMapExport({
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
}: Options) {
  return useCallback(async () => {
    if (!map) return;
    setExporting(true);
    try {
      const svg = await buildStandaloneLocationMapSvg(content, galleryMediaById, {
        title: map.name,
        subtitle: t('location_map_export_subtitle', {
          nodeCount: content.nodes.length,
          imageCount: content.images.length,
        }),
        colors,
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
    setExporting,
    showNotification,
    t,
  ]);
}
