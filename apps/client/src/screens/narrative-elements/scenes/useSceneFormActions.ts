import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import { parseCalendarDateCoordinate, type StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../../db';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import {
  saveSceneWithRelations,
  type SceneFormData,
} from '../../../services/storymanagement/SceneSaveCoordinator';
import type { SceneService } from '../../../services/storymanagement/SceneService';
import { AppAlert } from '../../../utils/AppAlert';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { parseTimingInput } from '../../../utils/sceneTimingInput';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import type { SceneFormState } from './useSceneFormState';

type SceneNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'SceneForm'>;

type UseSceneFormActionsOptions = {
  state: SceneFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  sceneServiceRef: RefObject<SceneService | null>;
  navigation: SceneNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(sceneId: string): Promise<void>;
  persistNoteRelations(sceneId: string): Promise<void>;
  persistCharacterRelations(sceneId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Scene form. */
export function useSceneFormActions({
  state,
  customFields,
  drizzleDb,
  sceneServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistCharacterRelations,
}: UseSceneFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Scene');
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
      if (!sceneServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      const gap = parseTimingInput(state.gapInput);
      const duration = parseTimingInput(state.durationInput);
      if (
        (state.gapInput !== '' && gap === null) ||
        (state.durationInput !== '' && duration === null)
      ) {
        AppAlert.alert(t('error'), t('scene_timing_invalid'));
        return;
      }
      const calendarDateOverride = state.calendarDateOverride.trim();
      if (calendarDateOverride && !parseCalendarDateCoordinate(calendarDateOverride)) {
        AppAlert.alert(t('error'), t('scene_fixed_date_invalid'));
        return;
      }

      try {
        const sceneData: SceneFormData = {
          chapterId: state.chapterId,
          locationId: state.locationId,
          name: state.name.trim(),
          summary: state.summary,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
          gap,
          gapType: state.gapType,
          calendarDateOverride: calendarDateOverride || null,
          calendarDateOverrideCalendarId: calendarDateOverride
            ? state.calendarDateOverrideCalendarId
            : null,
          duration,
          durationType: state.durationType,
          isStart: state.isStart,
          isFinish: state.isFinish,
        };

        const { sceneId, created } = await saveSceneWithRelations({
          sceneService: sceneServiceRef.current,
          userId,
          storyId,
          currentSceneId: state.currentSceneId,
          sceneData,
          notFoundMessage: copy.notFound,
          onScenePersisted: state.setCurrentSceneId,
          persistRelations: async (persistedSceneId) => {
            await persistTagRelations(persistedSceneId);
            await persistNoteRelations(persistedSceneId);
            await seeAlsoManagerRef.current?.persistPending(persistedSceneId);
            await persistCharacterRelations(persistedSceneId);
          },
          persistCustomAttributes: (persistedSceneId) =>
            createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Scene',
              persistedSceneId,
              state.customValues,
            ),
        });

        entityEventEmitter.emit('scene_changed', storyId, sceneId);
        AppAlert.alert(t('success'), state.isEditing ? copy.updated : copy.created);
        if (created) {
          navigation.dispatch(StackActions.replace('SceneForm', { sceneId }));
        } else {
          navigation.goBack();
        }
      } catch (error) {
        console.error('Failed to save scene:', error);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!state.currentSceneId || !sceneServiceRef.current) return;

    const sceneId = state.currentSceneId;
    confirmDelete({
      titleKey: 'delete_scene_title',
      title: copy.deleteLabel,
      messageKey: 'delete_scene_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_scene',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await sceneServiceRef.current!.deleteScene(userId, sceneId);
        entityEventEmitter.emit('scene_changed', storyId, sceneId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
