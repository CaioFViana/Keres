import { validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Note } from '@keres/shared/entities/Note';
import type { StorySchemaField } from '@keres/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppDrizzleClient } from '../../db';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { NotesStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import type { NoteService } from '../../services/storymanagement/NoteService';
import { AppAlert } from '../../utils/AppAlert';
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

/** Owns validation, persistence, feedback and navigation for the Note form. */
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
  const confirmDelete = useConfirmDelete();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.title.trim()) {
        AppAlert.alert(t('error'), t('note_title_required'));
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
      if (!noteServiceRef.current) {
        AppAlert.alert(t('error'), t('failed_to_save_note'));
        return;
      }

      try {
        const noteData: Omit<
          Note,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          title: state.title.trim(),
          body: state.body,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
        };

        const { created } = await saveEntityWithSecondaryData({
          currentEntityId: state.currentNoteId,
          createEntity: () =>
            noteServiceRef.current!.createNote(userId, {
              ...noteData,
              storyId,
            }),
          updateEntity: (noteId) => noteServiceRef.current!.updateNote(userId, noteId, noteData),
          onEntityPersisted: state.retainPersistedNoteId,
          persistSecondaryDraft,
          clearSecondaryDraft,
          persistSecondaryData: async (noteId) => {
            await persistTagRelations(noteId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              storyId,
              'Note',
              noteId,
              state.customValues,
            );
          },
        });

        AppAlert.alert(
          t('success'),
          t(created ? 'note_created_successfully' : 'note_updated_successfully'),
        );
        navigation.goBack();
      } catch (err) {
        console.error('Failed to save note:', err);
        AppAlert.alert(t('error'), t('failed_to_save_note'));
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!state.currentNoteId || !noteServiceRef.current) {
      return;
    }

    const noteId = state.currentNoteId;
    confirmDelete({
      titleKey: 'delete_note_title',
      messageKey: 'delete_note_message',
      successKey: 'note_deleted_successfully',
      failureKey: 'failed_to_delete_note',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await noteServiceRef.current!.deleteNote(userId, noteId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving };
}
