import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Chapter } from '@keres/shared/entities/Chapter';
import type { StorySchemaField } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../../db';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import type { ChapterService } from '../../../services/storymanagement/ChapterService';
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

type ChapterData = Omit<
  Chapter,
  | 'id'
  | 'storyId'
  | 'createdAt'
  | 'updatedAt'
  | 'version'
  | 'isDeleted'
  | 'deletedAt'
  | 'index'
  | 'rank'
>;

/** What differs for the Chapter form: its fields, service calls, numbering, secondary writes, texts and navigation. */
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
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const service = () => chapterServiceRef.current!;

  const actions = useEntityFormActions<ChapterData, { id: string }>({
    entityType: 'Chapter',
    changeEvent: 'chapter_changed',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentChapterId,
    isServiceReady: () => !!chapterServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedChapterId,
    validate: () => (state.name.trim() ? null : t('name_required')),
    buildData: () => ({
      name: state.name.trim(),
      summary: state.summary,
      isFavorite: state.isFavorite,
      extraNotes: state.extraNotes,
      arcId: state.arcId,
    }),
    create: async (currentUserId, currentStoryId, data) => {
      // Chapters and events number independently within their own kind.
      const containerType = state.isEvent ? 'event' : 'chapter';
      const siblings = await service().getAllByStoryId(currentStoryId, containerType);
      const nextIndex =
        siblings.length > 0 ? Math.max(...siblings.map((c) => c.index || 0)) + 1 : 1;
      return service().createChapter(currentUserId, {
        ...data,
        storyId: currentStoryId,
        index: nextIndex,
        type: containerType,
      });
    },
    update: (currentUserId, chapterId, data) =>
      service().updateChapter(currentUserId, chapterId, data),
    remove: (currentUserId, chapterId) => service().deleteChapter(currentUserId, chapterId),
    secondarySteps: [
      persistTagRelations,
      persistNoteRelations,
      (chapterId) => seeAlsoManagerRef.current?.persistPending(chapterId) ?? Promise.resolve(),
    ],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: copy.failedToSave,
      created: copy.created,
      updated: copy.updated,
    },
    confirmDelete: {
      titleKey: 'delete_chapter_title',
      title: copy.deleteLabel,
      messageKey: 'delete_chapter_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_chapter',
      failureMessage: copy.failedToDelete,
    },
    afterSave: (chapterId, created) => {
      if (created) {
        navigation.dispatch(StackActions.replace('ChapterForm', { chapterId }));
      } else {
        navigation.goBack();
      }
    },
    afterDelete: () => navigation.goBack(),
    logName: 'chapter',
  });

  return { ...actions, seeAlsoManagerRef };
}
