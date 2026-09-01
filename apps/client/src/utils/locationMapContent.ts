import type { LocationMapContentType } from '@keres/shared';
import {
  DEFAULT_LOCATION_MAP_NODE_COLOR,
  generateLocationMapLocalId,
  getEntityAppearance,
} from '@keres/shared';

export interface LocationMapImageEntry {
  galleryId: string;
  width: number;
  height: number;
}

export interface LocationMapMarkerEntry {
  title: string;
  note?: string | null;
}

/** Adds image bases to the map, each at a staggered position, returning the new content. */
export function appendImagesToMap(
  current: LocationMapContentType,
  entries: LocationMapImageEntry[],
): LocationMapContentType {
  const existing = new Set([
    ...current.images.map((image) => image.id),
    ...current.nodes.map((node) => node.id),
    ...(current.markers ?? []).map((marker) => marker.id),
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
    ...(current.markers ?? []).map((marker) => marker.id),
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
          destinationMapId: null,
        },
      ],
    };
    existing.add(next.nodes[next.nodes.length - 1].id);
  }
  return next;
}

/** Adds map-only markers without inventing a Location entity. */
export function appendMarkersToMap(
  current: LocationMapContentType,
  entries: LocationMapMarkerEntry[],
): LocationMapContentType {
  const existing = new Set([
    ...current.images.map((image) => image.id),
    ...current.nodes.map((node) => node.id),
    ...(current.markers ?? []).map((marker) => marker.id),
  ]);
  let next = current;
  for (const entry of entries) {
    const index = next.images.length + next.nodes.length + (next.markers?.length ?? 0);
    const marker = {
      id: generateLocationMapLocalId(existing),
      x: 160 + (index % 4) * 24,
      y: 160 + (index % 4) * 24,
      title: entry.title,
      note: entry.note ?? null,
      icon: 'pin',
      color: DEFAULT_LOCATION_MAP_NODE_COLOR,
      destinationMapId: null,
    };
    next = { ...next, markers: [...(next.markers ?? []), marker] };
    existing.add(marker.id);
  }
  return next;
}
