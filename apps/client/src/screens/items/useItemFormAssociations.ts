import { useCallback, useEffect, useMemo } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useCharacterStore } from '../../state/characterStore';

type UseItemFormAssociationsOptions = {
  currentItemId: string | undefined;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
};

/** Owns entity-relation and character-owner wiring used by the Item form. */
export function useItemFormAssociations({
  currentItemId,
  storyId,
  drizzleDb,
}: UseItemFormAssociationsOptions) {
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore();

  const relations = useEntityRelations({
    entityType: 'Item',
    entityId: currentItemId,
    preserveDraftOnEntityCreation: true,
  });

  useEffect(() => {
    if (drizzleDb && storyId) {
      setCharacterDbAndStoryId(drizzleDb, storyId);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [drizzleDb, storyId, setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters]);

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations],
  );

  const characterOptions = useMemo(
    () =>
      characters
        .filter((char) => !char.isDeleted)
        .map((char) => ({ label: char.name, value: char.id })),
    [characters],
  );

  return {
    ...relations,
    itemNoteRelations: relations.noteRelations,
    handleTagSelectionChange,
    characterOptions,
  };
}
