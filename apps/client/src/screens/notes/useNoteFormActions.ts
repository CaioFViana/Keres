import { useEntityFormActions } from '@/src/hooks/useEntityFormActions';
import type { Note } from '@keres/shared/entities/Note';
import type { StorySchemaField } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import type { NotesStackParamList } from '../../navigation/MainSystemStack';
import type { NoteService } from '../../services/storymanagement/NoteService';
import type { NoteFormState } from './useNoteFormState';

type NoteNavigation = NativeStackNavigationProp<NotesStackParamList, 'NoteForm'>;

type UseNoteFormActionsOptions = {
  state: NoteFormState;
  customFields: StorySchemaField[];
  drizzleDb: AppDrizzleClient;
  noteServiceRef: RefObject<NoteService | null>;
  navigation: NoteNavigation;
  storyId?: string;
  userId?: string | null;
  persistTagRelations(noteId: string): Promise<void>;
  persistSecondaryDraft?(noteId: string): Promise<void>;
  clearSecondaryDraft?(noteId: string): Promise<void>;
};

type NoteData = Omit<
  Note,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

/** What differs for the Note form: its fields, service calls, secondary writes, texts and navigation. */
export function useNoteFormActions({
  state,
  customFields,
  drizzleDb,
  noteServiceRef,
  navigation,
  storyId,
  userId,
  persistTagRelations,
  persistSecondaryDraft,
  clearSecondaryDraft,
}: UseNoteFormActionsOptions) {
  const { t } = useTranslation();
  const service = () => noteServiceRef.current!;

  return useEntityFormActions<NoteData, { id: string }>({
    entityType: 'Note',
    storyId,
    userId,
    drizzleDb,
    customFields,
    customValues: state.customValues,
    currentEntityId: state.currentNoteId,
    isServiceReady: () => !!noteServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: state.retainPersistedNoteId,
    validate: () => (state.title.trim() ? null : t('note_title_required')),
    buildData: () => ({
      title: state.title.trim(),
      body: state.body,
      isFavorite: state.isFavorite,
      extraNotes: state.extraNotes,
    }),
    create: (currentUserId, currentStoryId, data) =>
      service().createNote(currentUserId, { ...data, storyId: currentStoryId }),
    update: (currentUserId, noteId, data) => service().updateNote(currentUserId, noteId, data),
    remove: (currentUserId, noteId) => service().deleteNote(currentUserId, noteId),
    secondarySteps: [persistTagRelations],
    persistSecondaryDraft,
    clearSecondaryDraft,
    messages: {
      failedToSave: t('failed_to_save_note'),
      created: t('note_created_successfully'),
      updated: t('note_updated_successfully'),
    },
    confirmDelete: {
      titleKey: 'delete_note_title',
      messageKey: 'delete_note_message',
      successKey: 'note_deleted_successfully',
      failureKey: 'failed_to_delete_note',
    },
    afterSave: () => navigation.goBack(),
    afterDelete: () => navigation.goBack(),
    logName: 'note',
  });
}
