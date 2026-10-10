import { filterByNeighborhood } from './graphNeighborhood';
import type { GraphLocation, GraphLocationRelation } from './locationGraphLayout';

/**
 * Keeps the locations chosen for the focus view plus everyone directly related to them, and the
 * relations among that set (see `graphNeighborhood.ts`). Both relation kinds count as a connection -
 * `contains` (parent -> child) and `connected_to` (loose, no direction) - because "who is connected
 * to this place" is the same question for either. The screen filters before laying out, so the
 * interactive map and the exported SVG never disagree. An empty selection keeps everything.
 */
export function filterLocationGraph(
  locations: GraphLocation[],
  relations: GraphLocationRelation[],
  selectedIds: string[],
): { locations: GraphLocation[]; relations: GraphLocationRelation[] } {
  const kept = filterByNeighborhood(
    locations,
    relations,
    (relation) => [relation.locationAId, relation.locationBId],
    selectedIds,
  );
  return { locations: kept.nodes, relations: kept.edges };
}
