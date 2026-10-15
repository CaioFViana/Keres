import type { GraphLocation, GraphLocationRelation } from './locationGraphLayout';

/**
 * Folds the places a region holds into the region itself, so a large world reads as a handful of
 * regions until the author opens one. Folding a place hides everything under it through `contains`
 * (its children, their children...); a `connected_to` line to something hidden goes with it, since a
 * line cannot end in nothing.
 *
 * Pure on purpose, like the layout: the screen folds before laying out, so the map and the exported
 * image agree on what is visible. Corrupt data cannot hang it: a place is visited once, so a loop of
 * `contains` just ends.
 */
export function collapseLocationGraph(
  locations: GraphLocation[],
  relations: GraphLocationRelation[],
  collapsedIds: readonly string[],
): {
  locations: GraphLocation[];
  relations: GraphLocationRelation[];
  /** For each folded place that is still visible, how many places are folded into it. */
  hiddenCounts: Map<string, number>;
} {
  if (collapsedIds.length === 0) {
    return { locations, relations, hiddenCounts: new Map() };
  }

  const childrenOf = new Map<string, string[]>();
  for (const relation of relations) {
    if (relation.relationType !== 'contains') continue;
    const children = childrenOf.get(relation.locationAId) ?? [];
    children.push(relation.locationBId);
    childrenOf.set(relation.locationAId, children);
  }

  const known = new Set(locations.map((location) => location.id));
  const descendantsOf = (rootId: string): Set<string> => {
    const found = new Set<string>();
    const queue = [rootId];
    while (queue.length > 0) {
      for (const childId of childrenOf.get(queue.shift()!) ?? []) {
        if (childId === rootId || found.has(childId)) continue;
        found.add(childId);
        queue.push(childId);
      }
    }
    return found;
  };

  const hidden = new Set<string>();
  const folded = collapsedIds.filter((id) => known.has(id));
  for (const id of folded) {
    for (const descendant of descendantsOf(id)) hidden.add(descendant);
  }

  const hiddenCounts = new Map<string, number>();
  for (const id of folded) {
    if (hidden.has(id)) continue;
    const count = [...descendantsOf(id)].filter((descendant) => known.has(descendant)).length;
    if (count > 0) hiddenCounts.set(id, count);
  }

  return {
    locations: locations.filter((location) => !hidden.has(location.id)),
    relations: relations.filter(
      (relation) => !hidden.has(relation.locationAId) && !hidden.has(relation.locationBId),
    ),
    hiddenCounts,
  };
}
