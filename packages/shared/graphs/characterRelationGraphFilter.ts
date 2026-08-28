import type { GraphCharacter, GraphRelation } from './characterRelationGraphLayout';

/**
 * Keeps the characters chosen for the focus view plus everyone directly related to them, and the
 * relations among that set. Pure on purpose, like `characterRelationGraphLayout.ts`: the screen
 * filters before laying out, so the interactive map and the exported SVG never disagree about which
 * characters are visible.
 *
 * The kept set is the selected characters and their direct neighbours (an egocentric network): a
 * relation reaches in when one of its ends is selected, and the other end comes along. A relation
 * between two neighbours is kept too (both ends are in the set), giving context instead of a
 * dangling line. Characters further away - neighbours of neighbours - stay out, or the filter
 * would quietly grow back into the whole story.
 *
 * An empty selection keeps everything: the caller's default view is the complete map, and the
 * filter only narrows it.
 */
export function filterCharacterRelationGraph(
  characters: GraphCharacter[],
  relations: GraphRelation[],
  selectedIds: string[],
): { characters: GraphCharacter[]; relations: GraphRelation[] } {
  if (selectedIds.length === 0) {
    return { characters, relations };
  }

  const selected = new Set(selectedIds);
  const kept = new Set(selectedIds);
  // The neighbourhood is computed from the *original* selection only: adding to `kept` while
  // walking would pull in neighbours of neighbours, and the filter would quietly grow back into
  // the whole story.
  for (const relation of relations) {
    if (selected.has(relation.character1Id)) kept.add(relation.character2Id);
    if (selected.has(relation.character2Id)) kept.add(relation.character1Id);
  }

  // Original order is preserved: the layout is deterministic, and a filtered map reads the same as
  // the full one. Unknown ids are ignored - they simply never match a character.
  return {
    characters: characters.filter((character) => kept.has(character.id)),
    relations: relations.filter(
      (relation) =>
        kept.has(relation.character1Id) && kept.has(relation.character2Id),
    ),
  };
}