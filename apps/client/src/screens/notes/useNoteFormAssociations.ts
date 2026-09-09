import { useCallback } from 'react';
import { useEntityRelations } from '../../hooks/useEntityRelations';

type UseNoteFormAssociationsOptions = {
  currentNoteId: string | undefined;
};

/** Owns tag-relation wiring used by the Note form. Notes cannot attach to other notes. */
export function useNoteFormAssociations({ currentNoteId }: UseNoteFormAssociationsOptions) {
  const relations = useEntityRelations({
    entityType: 'Note',
    entityId: currentNoteId,
    withNotes: false,
    preserveDraftOnEntityCreation: true,
  });

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations.setSelectedTagIds],
  );

  return {
    availableTags: relations.availableTags,
    selectedTagIds: relations.selectedTagIds,
    persistTagRelations: relations.persistTagRelations,
    handleTagSelectionChange,
  };
}
