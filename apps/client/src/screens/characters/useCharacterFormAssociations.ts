import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import type { CharacterSelect } from '../../db/schemas/characters';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStoryStats } from '../../hooks/useStoryStats';
import type { CharacterRelationServiceInterface } from '../../services/storymanagement/CharacterRelationService';
import type { CharacterService } from '../../services/storymanagement/CharacterService';
import {
  patchEntityFormSecondaryDraft,
  readEntityFormSecondaryDraft,
} from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import { createModeService } from '../../services/storymanagement/ModeService';
import { createStatRelationService } from '../../services/storymanagement/StatRelationService';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';

type UseCharacterFormAssociationsOptions = {
  /** Route id when opening an existing character — used to restore durable pending relations. */
  initialCharacterId?: string;
  currentCharacterId: string | undefined;
  storyId?: string;
  userId?: string | null;
  drizzleDb: AppDrizzleClient;
  characterServiceRef: RefObject<CharacterService | null>;
  characterRelationServiceRef: RefObject<CharacterRelationServiceInterface | null>;
  onSecondaryDraftRestored?: () => void;
};

/** Owns relation, pending-relation, stats and mode wiring used by the Character form. */
export function useCharacterFormAssociations({
  initialCharacterId,
  currentCharacterId,
  storyId,
  userId,
  drizzleDb,
  characterServiceRef,
  characterRelationServiceRef,
  onSecondaryDraftRestored,
}: UseCharacterFormAssociationsOptions) {
  const { t } = useTranslation();
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const [characterRelations, setCharacterRelations] = useState<CharacterRelation[]>([]);
  // While `currentCharacterId` is undefined (creating), relations are held here - there is no real id
  // yet to save against. Replayed in `persistPendingCharacterRelations` after the main save.
  const [pendingCharacterRelations, setPendingCharacterRelations] = useState<CharacterRelation[]>(
    [],
  );

  const relations = useEntityRelations({
    entityType: 'Character',
    entityId: currentCharacterId,
    preserveDraftOnEntityCreation: true,
  });

  // Modes and stat values only exist once the character has an id, so the form surfaces them only
  // when editing - creating with modes already in place would require a pending queue like the
  // relations' one, with no gain: the author has only just named the character.
  const statData = useStoryStats(storyId);
  const characterModes = useMemo(
    () => statData.modes.filter((mode) => mode.characterId === currentCharacterId),
    [statData.modes, currentCharacterId],
  );
  const modeService = useCallback(() => createModeService(drizzleDb), [drizzleDb]);
  const statRelationService = useCallback(() => createStatRelationService(drizzleDb), [drizzleDb]);

  const fetchAllCharactersInStory = useCallback(async () => {
    if (!characterServiceRef.current || !storyId) {
      setAllCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(storyId);
      setAllCharacters(fetchedCharacters.filter((c) => !c.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [characterServiceRef, storyId]);

  const fetchRelationsForCharacter = useCallback(async () => {
    if (!characterRelationServiceRef.current || !storyId || !currentCharacterId) {
      setCharacterRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterRelationServiceRef.current.getRelationsForCharacter(
        storyId,
        currentCharacterId,
      );
      setCharacterRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character relations:', err);
    }
  }, [characterRelationServiceRef, storyId, currentCharacterId]);

  useEffect(() => {
    void fetchAllCharactersInStory();
    void fetchRelationsForCharacter();
  }, [fetchAllCharactersInStory, fetchRelationsForCharacter]);

  useEffect(() => {
    if (!storyId || !initialCharacterId) return;
    let cancelled = false;
    void (async () => {
      const draft = await readEntityFormSecondaryDraft(storyId, 'Character', initialCharacterId);
      if (cancelled || !draft?.pendingEntityRelations?.length) return;
      setPendingCharacterRelations(draft.pendingEntityRelations as CharacterRelation[]);
      onSecondaryDraftRestored?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, initialCharacterId, onSecondaryDraftRestored]);

  // Pending rows created before identity retention use '' for this character's side.
  // Rewrite them as soon as the real id exists so the manager filter keeps them visible.
  useEffect(() => {
    if (!currentCharacterId) return;
    setPendingCharacterRelations((prev) => {
      let changed = false;
      const next = prev.map((relation) => {
        if (relation.character1Id !== '' && relation.character2Id !== '') return relation;
        changed = true;
        return {
          ...relation,
          character1Id:
            relation.character1Id === '' ? currentCharacterId : relation.character1Id,
          character2Id:
            relation.character2Id === '' ? currentCharacterId : relation.character2Id,
        };
      });
      return changed ? next : prev;
    });
  }, [currentCharacterId]);

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      relations.setSelectedTagIds(newSelection);
    },
    [relations],
  );

  const syncPendingCharacterRelationsToDraft = useCallback(
    async (nextPending: CharacterRelation[]) => {
      if (!storyId || !currentCharacterId) return;
      await patchEntityFormSecondaryDraft(storyId, 'Character', currentCharacterId, {
        pendingEntityRelations: nextPending,
      });
    },
    [storyId, currentCharacterId],
  );

  const handleSaveRelation = async (relation: CharacterRelation) => {
    const pending = pendingCharacterRelations.find((item) => item.id === relation.id);
    if (pending || !currentCharacterId) {
      const previous = pendingCharacterRelations;
      const nextPending = (() => {
        const existingIndex = pendingCharacterRelations.findIndex((r) => r.id === relation.id);
        return existingIndex > -1
          ? pendingCharacterRelations.map((r, index) => (index === existingIndex ? relation : r))
          : [...pendingCharacterRelations, relation];
      })();
      setPendingCharacterRelations(nextPending);
      try {
        await syncPendingCharacterRelationsToDraft(nextPending);
        AppAlert.alert(t('success'), t('relation_saved_successfully'));
      } catch (error) {
        setPendingCharacterRelations(previous);
        AppAlert.alert(t('error'), t('failed_to_save_relation'));
        console.error('Failed to save pending character relation draft:', error);
      }
      return;
    }
    if (!characterRelationServiceRef.current || !storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await characterRelationServiceRef.current.saveCharacterRelation(
        userId,
        relation,
      );
      setCharacterRelations((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('character_relation_changed', storyId, currentCharacterId);
      AppAlert.alert(t('success'), t('relation_saved_successfully'));
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_save_relation'));
      console.error('Failed to save character relation:', error);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (
      !currentCharacterId ||
      pendingCharacterRelations.some((relation) => relation.id === relationId)
    ) {
      const previous = pendingCharacterRelations;
      const nextPending = pendingCharacterRelations.filter((r) => r.id !== relationId);
      setPendingCharacterRelations(nextPending);
      try {
        await syncPendingCharacterRelationsToDraft(nextPending);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } catch (error) {
        setPendingCharacterRelations(previous);
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
        console.error('Failed to delete pending character relation draft:', error);
      }
      return;
    }
    if (!characterRelationServiceRef.current || !storyId || !userId) {
      AppAlert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await characterRelationServiceRef.current.deleteCharacterRelation(
        userId,
        relationId,
      );
      if (success) {
        setCharacterRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('character_relation_changed', storyId, currentCharacterId);
        AppAlert.alert(t('success'), t('relation_deleted_successfully'));
      } else {
        AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      }
    } catch (error) {
      AppAlert.alert(t('error'), t('failed_to_delete_relation'));
      console.error('Failed to delete character relation:', error);
    }
  };

  /**
   * Saves relations accumulated while the character did not exist yet -
   * `character1Id`/`character2Id` held '' in place of the id.
   */
  const persistPendingCharacterRelations = async (targetCharacterId: string) => {
    if (!characterRelationServiceRef.current || !storyId || !userId) return;
    for (const pending of pendingCharacterRelations) {
      await characterRelationServiceRef.current.saveCharacterRelation(userId, {
        ...pending,
        character1Id: pending.character1Id === '' ? targetCharacterId : pending.character1Id,
        character2Id: pending.character2Id === '' ? targetCharacterId : pending.character2Id,
      });
      setPendingCharacterRelations((current) =>
        current.filter((relation) => relation.id !== pending.id),
      );
    }
    if (pendingCharacterRelations.length > 0) {
      entityEventEmitter.emit('character_relation_changed', storyId, targetCharacterId);
    }
  };

  return {
    ...relations,
    characterNoteRelations: relations.noteRelations,
    handleTagSelectionChange,
    allCharacters,
    // Persisted and pending queues stay visible together after identity retention / draft restore.
    characterRelations: [
      ...characterRelations,
      ...pendingCharacterRelations.map((relation) =>
        currentCharacterId
          ? {
              ...relation,
              character1Id:
                relation.character1Id === '' ? currentCharacterId : relation.character1Id,
              character2Id:
                relation.character2Id === '' ? currentCharacterId : relation.character2Id,
            }
          : relation,
      ),
    ],
    pendingCharacterRelations,
    handleSaveRelation,
    handleDeleteRelation,
    persistPendingCharacterRelations,
    statData,
    characterModes,
    modeService,
    statRelationService,
  };
}
