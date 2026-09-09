import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Chapter } from '@keres/shared/entities/Chapter';
import type { StorySchemaField } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../../db';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../../services/storymanagement/EntityFormSaveCoordinator';
import type { ChapterService } from '../../../services/storymanagement/ChapterService';
import { AppAlert } from '../../../utils/AppAlert';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import type { ChapterFormState } from './useChapterFormState';

type ChapterNavigation = NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChapterForm'>;

type UseChapterFormActionsOptions = {
  state: ChapterFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  chapterServiceRef: RefObject<ChapterService | null>;
  navigation: ChapterNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(chapterId: string): Promise<void>;
  persistNoteRelations(chapterId: string): Promise<void>;
  persistSecondaryDraft?(chapterId: string): Promise<void>;
  clearSecondaryDraft?(chapterId: string): Promise<void>;
};

/** Owns validation, persistence, feedback, events and navigation for the Chapter form. */
export function useChapterFormActions({
  state,
  customFields,
  drizzleDb,
  chapterServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistNoteRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseChapterFormActionsOptions) {
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy(state.isEvent ? 'Event' : 'Chapter');
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
      if (!chapterServiceRef.current) {
        AppAlert.alert(t('error'), copy.failedToSave);
        return;
      }

      try {
        const chapterData: Omit<
          Chapter,
          | 'id'
          | 'storyId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
          | 'index'
        > = {
          name: state.name.trim(),
          summary: state.summary,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
          arcId: state.arcId,
        };

        const { entityId: savedChapterId, created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentChapterId,
          createEntity: async () => {
            // Chapters and events number independently within their own kind.
            const containerType = state.isEvent ? 'event' : 'chapter';
            const siblings = await chapterServiceRef.current!.getAllByStoryId(
              storyId,
              containerType,
            );
            const nextIndex =
              siblings.length > 0 ? Math.max(...siblings.map((c) => c.index || 0)) + 1 : 1;
            return chapterServiceRef.current!.createChapter(userId, {
              ...chapterData,
              storyId,
              index: nextIndex,
              type: containerType,
            });
          },
          updateEntity: (chapterId) =>
            chapterServiceRef.current!.updateChapter(userId, chapterId, chapterData),
          onEntityPersisted: state.retainPersistedChapterId,
          persistSecondaryDraft,
          clearSecondaryDraft,
          persistSecondaryData: async (chapterId) => {
            await persistTagRelations(chapterId);
            await persistNoteRelations(chapterId);
            await seeAlsoManagerRef.current?.persistPending(chapterId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Chapter',
              chapterId,
              state.customValues,
            );
          },
        });

        entityEventEmitter.emit('chapter_changed', storyId, savedChapterId);
        AppAlert.alert(t('success'), created ? copy.created : copy.updated);

        if (created) {
          navigation.dispatch(StackActions.replace('ChapterForm', { chapterId: savedChapterId }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save chapter:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!state.currentChapterId || !chapterServiceRef.current) {
      return;
    }

    const chapterId = state.currentChapterId;
    confirmDelete({
      titleKey: 'delete_chapter_title',
      title: copy.deleteLabel,
      messageKey: 'delete_chapter_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_chapter',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await chapterServiceRef.current!.deleteChapter(userId, chapterId);
        entityEventEmitter.emit('chapter_changed', storyId, chapterId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef };
}
