import type { GraphLocation, GraphLocationRelation } from './locationGraphLayout';

/**
 * Keeps the locations chosen for the focus view plus everyone directly related to them, and the
 * relations among that set. Pure on purpose, like `locationGraphLayout.ts`: the screen filters
 * before laying out, so the interactive map and the exported SVG never disagree about which
 * locations are visible.
 *
 * The kept set is the selected locations and their direct neighbours (an egocentric network). Both
 * relation kinds count as a connection - `contains` (parent -> child) and `connected_to` (loose,
 * no direction) - because "who is connected to this place" is the same question for either. A
 * relation between two neighbours is kept too (both ends are in the set), giving context instead
 * of a dangling line. Locations further away - neighbours of neighbours - stay out, or the filter
 * would quietly grow back into the whole map.
 *
 * An empty selection keeps everything: the caller's default view is the complete map, and the
 * filter only narrows it.
 */
export function filterLocationGraph(
  locations: GraphLocation[],
  relations: GraphLocationRelation[],
  selectedIds: string[],
): { locations: GraphLocation[]; relations: GraphLocationRelation[] } {
  if (selectedIds.length === 0) {
    return { locations, relations };
  }

  const selected = new Set(selectedIds);
  const kept = new Set(selectedIds);
  // The neighbourhood is computed from the *original* selection only: adding to `kept` while
  // walking would pull in neighbours of neighbours, and the filter would quietly grow back into
  // the whole map.
  for (const relation of relations) {
    if (selected.has(relation.locationAId)) kept.add(relation.locationBId);
    if (selected.has(relation.locationBId)) kept.add(relation.locationAId);
  }

  // Original order is preserved: the layout is deterministic, and a filtered map reads the same as
  // the full one. Unknown ids are ignored - they simply never match a location.
  return {
    locations: locations.filter((location) => kept.has(location.id)),
    relations: relations.filter(
      (relation) => kept.has(relation.locationAId) && kept.has(relation.locationBId),
    ),
  };
}
