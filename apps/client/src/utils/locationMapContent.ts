import type { LocationMapContentType } from '@keres/shared';
import { DEFAULT_LOCATION_MAP_NODE_COLOR, generateLocationMapLocalId, getEntityAppearance } from '@keres/shared';

export interface LocationMapImageEntry {
  galleryId: string;
  width: number;
  height: number;
}

/** Adds image bases to the map, each at a staggered position, returning the new content. */
export function appendImagesToMap(
  current: LocationMapContentType,
  entries: LocationMapImageEntry[],
): LocationMapContentType {
  const existing = new Set([
    ...current.images.map((image) => image.id),
    ...current.nodes.map((node) => node.id),
  ]);
  let next = current;
  for (const entry of entries) {
    const index = next.images.length + next.nodes.length;
    next = {
      ...next,
      images: [
        ...next.images,
        {
          id: generateLocationMapLocalId(existing),
          galleryId: entry.galleryId,
          x: 80 + (index % 4) * 24,
          y: 80 + (index % 4) * 24,
          width: entry.width,
          height: entry.height,
          locked: false,
        },
      ],
    };
    existing.add(next.images[next.images.length - 1].id);
  }
  return next;
}

/** Adds location points to the map, each at a staggered position, returning the new content. */
export function appendLocationsToMap(
  current: LocationMapContentType,
  locationIds: string[],
): LocationMapContentType {
  const existing = new Set([
    ...current.images.map((image) => image.id),
    ...current.nodes.map((node) => node.id),
  ]);
  let next = current;
  for (const locationId of locationIds) {
    const index = next.images.length + next.nodes.length;
    next = {
      ...next,
      nodes: [
        ...next.nodes,
        {
          id: generateLocationMapLocalId(existing),
          locationId,
          x: 120 + (index % 4) * 24,
          y: 120 + (index % 4) * 24,
          icon: getEntityAppearance('Location').icon,
          color: DEFAULT_LOCATION_MAP_NODE_COLOR,
        },
      ],
    };
    existing.add(next.nodes[next.nodes.length - 1].id);
  }
  return next;
}