import type { GraphCharacter, GraphRelation } from './characterRelationGraphLayout';
import { filterByNeighborhood } from './graphNeighborhood';

/**
 * Keeps the characters chosen for the focus view plus everyone directly related to them, and the
 * relations among that set (see `graphNeighborhood.ts`). The screen filters before laying out, so
 * the interactive map and the exported SVG never disagree about which characters are visible.
 * An empty selection keeps everything.
 */
export function filterCharacterRelationGraph(
  characters: GraphCharacter[],
  relations: GraphRelation[],
  selectedIds: string[],
): { characters: GraphCharacter[]; relations: GraphRelation[] } {
  const kept = filterByNeighborhood(
    characters,
    relations,
    (relation) => [relation.character1Id, relation.character2Id],
    selectedIds,
  );
  return { characters: kept.nodes, relations: kept.edges };
}
