import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { createCharacterRelationService } from '../../services/storymanagement/CharacterRelationService';
import { AppAlert } from '../../utils/AppAlert';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';

interface EditorTarget {
  /** The character whose relations are being edited: the node that was in focus. */
  characterId: string;
  /** The relation being changed, or null while adding one. */
  relationId: string | null;
}

interface CharacterRelationEditorInput {
  db: AppDrizzleClient;
  storyId?: string;
  userId?: string | null;
  relations: readonly CharacterRelation[];
  /** Loads the map again once something was written. */
  reload: () => Promise<void>;
}

/**
 * Adding, changing and removing the relations of a character from the relations map. The pairs and the
 * rules are the ones of the character's own page: a pair has one relation, written with its two ids in
 * order, and a change goes through the same service and announces itself the same way. The map shows
 * the result straight away because it loads again afterwards.
 */
export function useCharacterRelationEditor({
  db,
  storyId,
  userId,
  relations,
  reload,
}: CharacterRelationEditorInput) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<EditorTarget | null>(null);

  const editing = useMemo(
    () => relations.find((relation) => relation.id === target?.relationId) ?? null,
    [relations, target?.relationId],
  );

  /** Who the character already has a relation with: the picker leaves them out. */
  const relatedCharacterIds = useMemo(() => {
    if (!target) return [];
    return relations
      .filter(
        (relation) =>
          relation.character1Id === target.characterId ||
          relation.character2Id === target.characterId,
      )
      .map((relation) =>
        relation.character1Id === target.characterId
          ? relation.character2Id
          : relation.character1Id,
      );
  }, [relations, target]);

  const openAdd = useCallback(
    (characterId: string) => setTarget({ characterId, relationId: null }),
    [],
  );
  const openEdit = useCallback(
    (characterId: string, relationId: string) => setTarget({ characterId, relationId }),
    [],
  );
  const close = useCallback(() => setTarget(null), []);

  const save = useCallback(
    async (relatedCharacterId: string, relationType: string, relationId?: string) => {
      if (!target || !storyId || !userId) {
        AppAlert.alert(t('error'), t('service_not_initialized'));
        return;
      }
      // The two ids in order, so A-B and B-A are the same pair.
      const [character1Id, character2Id] = [target.characterId, relatedCharacterId].sort();
      const relation: CharacterRelation = {
        id: relationId || createULID(),
        storyId,
        character1Id,
        character2Id,
        relationType,
        createdAt: editing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        version: editing?.version ?? 1,
        isDeleted: editing?.isDeleted ?? false,
        deletedAt: editing?.deletedAt ?? null,
      };
      try {
        await createCharacterRelationService(db).saveCharacterRelation(userId, relation);
        entityEventEmitter.emit('character_relation_changed', storyId, target.characterId);
        await reload();
      } catch (error) {
        console.error('Failed to save character relation:', error);
        AppAlert.alert(t('error'), t('failed_to_save_relation'));
      }
    },
    [db, editing, reload, storyId, t, target, userId],
  );

  const remove = useCallback(
    (characterId: string, relationId: string) => {
      const confirmed = async () => {
        if (!storyId || !userId) {
          AppAlert.alert(t('error'), t('service_not_initialized'));
          return;
        }
        try {
          const done = await createCharacterRelationService(db).deleteCharacterRelation(
            userId,
            relationId,
          );
          if (!done) {
            AppAlert.alert(t('error'), t('failed_to_delete_relation'));
            return;
          }
          entityEventEmitter.emit('character_relation_changed', storyId, characterId);
          await reload();
        } catch (error) {
          console.error('Failed to delete character relation:', error);
          AppAlert.alert(t('error'), t('failed_to_delete_relation'));
        }
      };
      AppAlert.alert(
        t('delete_character_relation_title'),
        t('delete_character_relation_message'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('delete'), style: 'destructive', onPress: () => void confirmed() },
        ],
        { cancelable: true },
      );
    },
    [db, reload, storyId, t, userId],
  );

  return {
    /** The open editor: who is being edited and which relation, or null while it is closed. */
    target,
    editing,
    relatedCharacterIds,
    openAdd,
    openEdit,
    close,
    save,
    remove,
  };
}
