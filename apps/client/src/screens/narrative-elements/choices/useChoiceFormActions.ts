import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Choice } from '@keres/shared/entities/Choice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import type { ChoiceService } from '../../../services/storymanagement/ChoiceService';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import type { ChoiceFormState } from './useChoiceFormState';

type ChoiceNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChoiceForm'>;

type UseChoiceFormActionsOptions = {
  state: ChoiceFormState;
  choiceServiceRef: RefObject<ChoiceService | null>;
  navigation: ChoiceNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(choiceId: string): Promise<void>;
  persistNoteRelations(choiceId: string): Promise<void>;
  persistSecondaryDraft?(choiceId: string): Promise<void>;
  clearSecondaryDraft?(choiceId: string): Promise<void>;
};

type ChoiceData = Omit<
  Choice,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the Choice form: its fields, service calls, secondary writes, texts and navigation. */
export function useChoiceFormActions({
  state,
  choiceServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseChoiceFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Choice');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => choiceServiceRef.current!;

  const actions = useEntityFormActions<ChoiceData, { id: string }>({
    changeEvent: 'choice_changed',
    storyId,
    userId,
    currentEntityId: state.currentChoiceId,
    isServiceReady: () => !!choiceServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedChoiceId,
    validate: () => {
      if (!state.text.trim()) return t('text_required');
      if (!state.sceneId) return sceneCopy.required;
      if (!state.nextSceneId) return t('next_scene_required');
      return null;
    },
    buildData: () => ({
      sceneId: state.sceneId!,
      nextSceneId: state.nextSceneId!,
      text: state.text.trim(),
      notes: state.notes && state.notes.trim() ? state.notes.trim() : null,
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createChoice(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, choiceId, data) =>
      service().updateChoice(currentUserId, choiceId, data),
    remove: (currentUserId, choiceId) => service().deleteChoice(currentUserId, choiceId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (choiceId) => seeAlsoManagerRef.current?.persistPending(choiceId) ?? Promise.resolve(),
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_choice_title',
      title: copy.deleteLabel,
      messageKey: 'delete_choice_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_choice',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (choiceId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('ChoiceForm', { choiceId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'choice',
  });

  return { ...actions, seeAlsoManagerRef };
}
