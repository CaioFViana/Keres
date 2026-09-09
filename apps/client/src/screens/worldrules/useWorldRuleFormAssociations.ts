import { useCallback } from 'react';
import { useEntityRelations } from '../../hooks/useEntityRelations';

type UseWorldRuleFormAssociationsOptions = {
  currentWorldRuleId: string | undefined;
};

/** Owns entity-relation wiring used by the WorldRule form. */
export function useWorldRuleFormAssociations({
  currentWorldRuleId,
}: UseWorldRuleFormAssociationsOptions) {
  const relations = useEntityRelations({
    entityType: 'WorldRule',
    entityId: currentWorldRuleId,
    preserveDraftOnEntityCreation: true,
  });

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations.setSelectedTagIds],
  );

  return {
    ...relations,
    worldRuleNoteRelations: relations.noteRelations,
    handleTagSelectionChange,
  };
}
