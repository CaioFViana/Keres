import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Character } from '@keres/shared/entities/Character';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import type { CharacterStackParamList } from '../../navigation/MainSystemStack';
import type { CharacterService } from '../../services/storymanagement/CharacterService';
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
  persistSecondaryDraft?(characterId: string): Promise<void>;
  clearSecondaryDraft?(characterId: string): Promise<void>;
};

type CharacterData = Omit<
  Character,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the Character form: its fields, service calls, secondary writes, texts and navigation. */
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
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseCharacterFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Character');
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => characterServiceRef.current!;

  const actions = useEntityFormActions<CharacterData, { id: string }>({
    entityType: 'Character',
    changeEvent: 'character_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentCharacterId,
    isServiceReady: () => !!characterServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedCharacterId,
    validate: () => (state.name.trim() ? null : t('name_required')),
    buildData: () => ({
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
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createCharacter(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, characterId, data) =>
      service().updateCharacter(currentUserId, characterId, data),
    remove: (currentUserId, characterId) => service().deleteCharacter(currentUserId, characterId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (characterId) => seeAlsoManagerRef.current?.persistPending(characterId) ?? Promise.resolve(),
      persistPendingCharacterRelations,
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_character_title',
      title: copy.deleteLabel,
      messageKey: 'delete_character_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_character',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (characterId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('CharacterForm', { characterId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'character',
  });

  return { ...actions, seeAlsoManagerRef };
}
