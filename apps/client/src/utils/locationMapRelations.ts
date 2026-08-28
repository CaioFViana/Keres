import type { LocationMapContentType } from '@keres/shared';
import type { LocationRelationSelect } from '../db/schema';
import type { LocationMapConnection, LocationMapContains } from '@/src/components/features/location-maps/LocationMapCanvas';

/** The `connected_to` relations between locations that are actually on the map. */
export function deriveConnections(
  relations: LocationRelationSelect[],
  content: LocationMapContentType,
): LocationMapConnection[] {
  const nodeLocationIds = new Set(content.nodes.map((node) => node.locationId));
  return relations
    .filter(
      (relation) =>
        relation.relationType === 'connected_to' &&
        nodeLocationIds.has(relation.locationAId) &&
        nodeLocationIds.has(relation.locationBId),
    )
    .map((relation) => ({ locationAId: relation.locationAId, locationBId: relation.locationBId }));
}

/** The `contains` relations between locations that are actually on the map (parent -> child). */
export function deriveContains(
  relations: LocationRelationSelect[],
  content: LocationMapContentType,
): LocationMapContains[] {
  const nodeLocationIds = new Set(content.nodes.map((node) => node.locationId));
  return relations
    .filter(
      (relation) =>
        relation.relationType === 'contains' &&
        nodeLocationIds.has(relation.locationAId) &&
        nodeLocationIds.has(relation.locationBId),
    )
    .map((relation) => ({
      parentLocationId: relation.locationAId,
      childLocationId: relation.locationBId,
    }));
}