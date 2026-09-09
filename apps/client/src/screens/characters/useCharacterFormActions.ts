import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Character } from '@keres/shared/entities/Character';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { CharacterStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { CharacterService } from '../../services/storymanagement/CharacterService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { CharacterFormState } from './useCharacterFormState';

type CharacterNavigation = NativeStackNavigationProp<CharacterStackParamList, 'CharacterForm'>;

type UseCharacterFormActionsOptions = {
  state: CharacterFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  characterServiceRef: RefObject<CharacterService | null>;
  navigation: CharacterNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(characterId: string): Promise<void>;
  persistNoteRelations(characterId: string): Promise<void>;
  persistPendingCharacterRelations(characterId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Character form. */
export function useCharacterFormActions({
  state,
  customFields,
  drizzleDb,
  characterServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistPendingCharacterRelations,
}: UseCharacterFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.name.trim()) {
        AppAlert.alert(t('error'), t('name_required'));
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(
        customFields,
        state.customValues,
      );
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!storyId) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }
      if (!characterServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const characterData: Omit<
          Character,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: state.name.trim(),
          title: state.title ? state.title.trim() : null,
          description: state.description,
          gender: state.gender,
          race: state.race,
          subrace: state.subrace,
          personality: state.personality,
          motivation: state.motivation,
          qualities: state.qualities,
          weaknesses: state.weaknesses,
          biography: state.biography,
          plannedTimeline: state.plannedTimeline,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
        };

        const { entityId: savedCharacterId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentCharacterId,
          createEntity: () =>
            characterServiceRef.current!.createCharacter(userId, {
              ...characterData,
              storyId,
            }),
          updateEntity: (characterId) =>
            characterServiceRef.current!.updateCharacter(userId, characterId, characterData),
          onEntityPersisted: state.retainPersistedCharacterId,
          persistSecondaryData: async (characterId) => {
            await persistTagRelations(characterId);
            await persistNoteRelations(characterId);
            await seeAlsoManagerRef.current?.persistPending(characterId);
            await persistPendingCharacterRelations(characterId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Character',
              characterId,
              state.customValues,
            );
          },
        });

        entityEventEmitter.emit('character_changed', storyId, savedCharacterId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(
            StackActions.replace('CharacterForm', {
              characterId: savedCharacterId,
            }),
          );
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save character:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentCharacterId || !characterServiceRef.current) {
      return;
    }

    const characterId = state.currentCharacterId;
    confirmDelete({
      titleKey: 'delete_character_title',
      title: copy.deleteLabel,
      messageKey: 'delete_character_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_character',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await characterServiceRef.current!.deleteCharacter(userId, characterId);
        entityEventEmitter.emit('character_changed', storyId, characterId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
