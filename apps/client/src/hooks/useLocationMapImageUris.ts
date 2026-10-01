import type { LocationMapContentType } from '@keres/shared';
import { useMemo } from 'react';
import type { GallerySelect, LocationSelect } from '../db/schema';
import { useResolvedMediaUris } from './useResolvedMediaUris';

/**
 * Derived map media: gallery metadata by id, resolved image-base URIs, and location names
 * by point. Extracted from the map screen so overlay wiring fits the file-size gate.
 */
export function useLocationMapImageUris(
  galleries: GallerySelect[],
  images: LocationMapContentType['images'],
  locations: LocationSelect[],
  nodes: LocationMapContentType['nodes'],
) {
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
      images.map((image) => {
        const media = galleryMediaById[image.galleryId];
        if (!media || media.mediaType !== 'image') return null;
        return media.localPath;
      }),
    [images, galleryMediaById],
  );
  const resolvedUris = useResolvedMediaUris(imagePaths);
  const imageUris = useMemo(() => {
    const next: Record<string, string | null> = {};
    images.forEach((image, index) => {
      const path = imagePaths[index];
      next[image.galleryId] = path ? (resolvedUris[path] ?? null) : null;
    });
    return next;
  }, [images, imagePaths, resolvedUris]);
  const nodeNames = useMemo(() => {
    const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
    const next: Record<string, string> = {};
    for (const node of nodes)
      next[node.locationId] = locationNameById.get(node.locationId) ?? node.locationId;
    return next;
  }, [locations, nodes]);
  return { galleryMediaById, imageUris, nodeNames };
}
