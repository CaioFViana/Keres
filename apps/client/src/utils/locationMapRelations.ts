import type { LocationMapContentType } from '@keres/shared';
import type { LocationRelationSelect } from '../db/schema';
import type {
  LocationMapConnection,
  LocationMapContains,
} from '@/src/components/features/location-maps/LocationMapCanvas';

/** The `connected_to` relations between locations that are actually on the map. */
export function deriveConnections(
  relations: LocationRelationSelect[],
  content: Pick<LocationMapContentType, 'nodes' | 'relationTexts'>,
): LocationMapConnection[] {
  const nodeLocationIds = new Set(content.nodes.map((node) => node.locationId));
  return relations
    .filter(
      (relation) =>
        relation.relationType === 'connected_to' &&
        nodeLocationIds.has(relation.locationAId) &&
        nodeLocationIds.has(relation.locationBId),
    )
    .map((relation) => {
      const label = relationText(content, relation.locationAId, relation.locationBId, true);
      return {
        locationAId: relation.locationAId,
        locationBId: relation.locationBId,
        ...(label ? { label } : {}),
      };
    });
}

/** The `contains` relations between locations that are actually on the map (parent -> child). */
export function deriveContains(
  relations: LocationRelationSelect[],
  content: Pick<LocationMapContentType, 'nodes' | 'relationTexts'>,
): LocationMapContains[] {
  const nodeLocationIds = new Set(content.nodes.map((node) => node.locationId));
  return relations
    .filter(
      (relation) =>
        relation.relationType === 'contains' &&
        nodeLocationIds.has(relation.locationAId) &&
        nodeLocationIds.has(relation.locationBId),
    )
    .map((relation) => {
      const label = relationText(content, relation.locationAId, relation.locationBId);
      return {
        parentLocationId: relation.locationAId,
        childLocationId: relation.locationBId,
        ...(label ? { label } : {}),
      };
    });
}

function relationText(
  content: Pick<LocationMapContentType, 'relationTexts'>,
  sourceLocationId: string,
  destinationLocationId: string,
  matchReverse = false,
): string | null {
  const direct = content.relationTexts?.find(
    (entry) =>
      entry.sourceLocationId === sourceLocationId &&
      entry.destinationLocationId === destinationLocationId,
  );
  if (direct) return direct.text;
  if (!matchReverse) return null;
  return (
    content.relationTexts?.find(
      (entry) =>
        entry.sourceLocationId === destinationLocationId &&
        entry.destinationLocationId === sourceLocationId,
    )?.text ?? null
  );
}

export interface LocationMapParentRelation {
  relationId: string;
  locationId: string;
  name: string;
}

export interface LocationMapChildRelation {
  relationId: string;
  locationId: string;
  name: string;
}

/** The `contains` relation that makes `locationId` a child (its parent), if any. */
export function deriveParent(
  relations: LocationRelationSelect[],
  locationId: string,
  nameById: Map<string, string>,
): LocationMapParentRelation | null {
  const relation = relations.find(
    (r) => r.relationType === 'contains' && r.locationBId === locationId,
  );
  if (!relation) return null;
  return {
    relationId: relation.id,
    locationId: relation.locationAId,
    name: nameById.get(relation.locationAId) ?? relation.locationAId,
  };
}

/** The `contains` relations that make `locationId` a parent (its children). */
export function deriveChildren(
  relations: LocationRelationSelect[],
  locationId: string,
  nameById: Map<string, string>,
): LocationMapChildRelation[] {
  return relations
    .filter((r) => r.relationType === 'contains' && r.locationAId === locationId)
    .map((relation) => ({
      relationId: relation.id,
      locationId: relation.locationBId,
      name: nameById.get(relation.locationBId) ?? relation.locationBId,
    }));
}

/** `locationId`'s ancestors through `contains` (excluding itself) - invalid parent candidates. */
export function computeAncestorIds(
  relations: LocationRelationSelect[],
  locationId: string,
): Set<string> {
  const ancestors = new Set<string>();
  let currentId: string | undefined = locationId;
  while (currentId) {
    const parentEdge = relations.find(
      (r) => r.relationType === 'contains' && r.locationBId === currentId,
    );
    if (!parentEdge || ancestors.has(parentEdge.locationAId)) break;
    ancestors.add(parentEdge.locationAId);
    currentId = parentEdge.locationAId;
  }
  return ancestors;
}

/** `locationId`'s descendants through `contains` (excluding itself) - invalid child candidates. */
export function computeDescendantIds(
  relations: LocationRelationSelect[],
  locationId: string,
): Set<string> {
  const descendants = new Set<string>();
  const queue = [locationId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = relations.filter(
      (r) => r.relationType === 'contains' && r.locationAId === current,
    );
    for (const child of children) {
      if (!descendants.has(child.locationBId)) {
        descendants.add(child.locationBId);
        queue.push(child.locationBId);
      }
    }
  }
  return descendants;
}
