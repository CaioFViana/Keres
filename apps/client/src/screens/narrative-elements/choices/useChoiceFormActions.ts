import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Choice } from '@keres/shared/entities/Choice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import type { ChoiceService } from '../../../services/storymanagement/ChoiceService';
import { saveEntityWithSecondaryData } from '../../../services/storymanagement/EntityFormSaveCoordinator';
import { AppAlert } from '../../../utils/AppAlert';
import { entityEventEmitter } from '../../../utils/EventEmitter';
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

/** Owns validation, persistence, feedback, events and navigation for the Choice form. */
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
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.text.trim()) {
        AppAlert.alert(t('error'), t('text_required'));
        return;
      }
      if (!state.sceneId) {
        AppAlert.alert(t('error'), sceneCopy.required);
        return;
      }
      if (!state.nextSceneId) {
        AppAlert.alert(t('error'), t('next_scene_required'));
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
      if (!choiceServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const choiceData: Omit<
          Choice,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          sceneId: state.sceneId,
          nextSceneId: state.nextSceneId,
          text: state.text.trim(),
          notes: state.notes && state.notes.trim() ? state.notes.trim() : null,
        };

        const { entityId: savedChoiceId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentChoiceId,
          createEntity: () =>
            choiceServiceRef.current!.createChoice(userId, {
              ...choiceData,
              storyId,
            }),
          updateEntity: (choiceId) =>
            choiceServiceRef.current!.updateChoice(userId, choiceId, choiceData),
          onEntityPersisted: state.retainPersistedChoiceId,
          persistSecondaryDraft,
          clearSecondaryDraft,
          persistSecondaryData: async (choiceId) => {
            await persistTagRelations(choiceId);
            await persistNoteRelations(choiceId);
            await seeAlsoManagerRef.current?.persistPending(choiceId);
          },
        });

        entityEventEmitter.emit('choice_changed', storyId, savedChoiceId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(StackActions.replace('ChoiceForm', { choiceId: savedChoiceId }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save choice:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentChoiceId || !choiceServiceRef.current) {
      return;
    }

    const choiceId = state.currentChoiceId;
    confirmDelete({
      titleKey: 'delete_choice_title',
      title: copy.deleteLabel,
      messageKey: 'delete_choice_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_choice',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await choiceServiceRef.current!.deleteChoice(userId, choiceId);
        entityEventEmitter.emit('choice_changed', storyId, choiceId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
