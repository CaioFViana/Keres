import { useCallback } from 'react';
import type { ArcMembershipKind } from '../services/storymanagement/StoryArcService';
import { useStoryStore } from '../state/storyStore';
import type { AdvancedSearchCriteria } from '../types/entityFilters';
import { entityBelongsToActiveArc } from '../utils/storyArcFilter';
import { useArcSearchScope } from './useArcSearchScope';
import { useEntityArcIds } from './useEntityArcIds';

/**
 * The arc half of a list that shows one story arc at a time: the rows of the active arc (with what a
 * search found beyond it counted, see `useArcSearchScope`), and the filters dialog's count restricted to
 * the same arc, so the number it shows is the number the list would show.
 */
export function useEntityArcScope<T extends { id: string }>({
  storyId,
  kind,
  rows,
  searchTerm,
  findMatching,
}: {
  storyId: string | undefined;
  kind: ArcMembershipKind;
  rows: T[];
  searchTerm: string | undefined;
  findMatching: (criteria: AdvancedSearchCriteria) => Promise<unknown>;
}) {
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const arcIds = useEntityArcIds(storyId ?? '', kind);
  const inActiveArc = useCallback(
    (entity: T) => entityBelongsToActiveArc(arcIds.get(entity.id), activeArcId),
    [arcIds, activeArcId],
  );
  // The filters dialog counts what this list would show: the active arc's rows, like the list itself.
  const previewCount = useCallback(
    async (criteria: AdvancedSearchCriteria) =>
      ((await findMatching(criteria)) as T[]).filter(inActiveArc).length,
    [findMatching, inActiveArc],
  );
  const { data, outsideCount, expanded, toggle } = useArcSearchScope(rows, inActiveArc, searchTerm);

  return { data, outsideCount, expanded, toggle, previewCount };
}
