import type { NoteRelation } from '@keres/shared/entities/Note';
import { useCallback } from 'react';
import {
  clearEntityFormSecondaryDraft,
  writeEntityFormSecondaryDraft,
} from '../services/storymanagement/EntityFormSecondaryDraftStore';

type UseEntityFormSecondaryDraftOptions = {
  storyId?: string;
  entityType: string;
  selectedTagIds: string[];
  pendingNoteRelations: NoteRelation[];
  getCustomValues: () => Record<string, string | null>;
};

/**
 * Wires durable secondary drafts into multi-step form saves: capture after the base row exists,
 * clear only after secondary writes succeed.
 */
export function useEntityFormSecondaryDraft({
  storyId,
  entityType,
  selectedTagIds,
  pendingNoteRelations,
  getCustomValues,
}: UseEntityFormSecondaryDraftOptions) {
  const persistSecondaryDraft = useCallback(
    async (entityId: string) => {
      if (!storyId || !entityId) return;
      await writeEntityFormSecondaryDraft(storyId, entityType, entityId, {
        selectedTagIds,
        pendingNoteRelations,
        customValues: getCustomValues(),
      });
    },
    [storyId, entityType, selectedTagIds, pendingNoteRelations, getCustomValues],
  );

  const clearSecondaryDraft = useCallback(
    async (entityId: string) => {
      if (!storyId || !entityId) return;
      await clearEntityFormSecondaryDraft(storyId, entityType, entityId);
    },
    [storyId, entityType],
  );

  return { persistSecondaryDraft, clearSecondaryDraft };
}
