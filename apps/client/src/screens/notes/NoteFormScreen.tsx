import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { Note } from '@keres/shared/entities/Note';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { NotesStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { saveEntityWithSecondaryData } from '../../services/storymanagement/EntityFormSaveCoordinator';
import { createNoteService } from '../../services/storymanagement/NoteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type NoteFormScreenRouteProp = RouteProp<NotesStackParamList, 'NoteForm'>;

const NoteFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<NoteFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { noteId: initialNoteId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const noteService = useCallback(() => createNoteService(drizzleDb), [drizzleDb]);
  const confirmDelete = useConfirmDelete();

  const [currentNoteId, setCurrentNoteId] = useState<string | undefined>(initialNoteId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  // Notes can't be attached to other notes, so only the tag half of the hook applies.
  const { availableTags, selectedTagIds, setSelectedTagIds, persistTagRelations } =
    useEntityRelations({
      entityType: 'Note',
      entityId: currentNoteId,
      withNotes: false,
      preserveDraftOnEntityCreation: true,
    });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Note');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentNoteId;

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_note_title') : t('create_note_title'),
  });

  useEffect(() => {
    const loadNote = async () => {
      if (!initialNoteId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedNote = await noteService().getById(initialNoteId);
        if (fetchedNote) {
          setTitle(fetchedNote.title);
          setBody(fetchedNote.body);
          setIsFavorite(fetchedNote.isFavorite);
          setExtraNotes(fetchedNote.extraNotes);

          const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
            initialNoteId,
          );
          setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
        } else {
          console.warn('Note not found:', initialNoteId);
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNote();
  }, [drizzleDb, initialNoteId, noteService, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = () =>
    runSave(async () => {
      if (!title.trim()) {
        AppAlert.alert(t('error'), t('note_title_required'));
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!selectedStory?.id) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }

      try {
        const noteData: Omit<
          Note,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          title: title.trim(),
          body: body,
          isFavorite: isFavorite,
          extraNotes: extraNotes,
        };

        const { created } = await saveEntityWithSecondaryData({
          currentEntityId: currentNoteId,
          createEntity: () =>
            noteService().createNote(userId, {
              ...noteData,
              storyId: selectedStory.id,
            }),
          updateEntity: (noteId) => noteService().updateNote(userId, noteId, noteData),
          onEntityPersisted: setCurrentNoteId,
          persistSecondaryData: async (noteId) => {
            await persistTagRelations(noteId);
            await createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              selectedStory.id,
              'Note',
              noteId,
              customValues,
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
    if (!currentNoteId) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_note_title',
      messageKey: 'delete_note_message',
      successKey: 'note_deleted_successfully',
      failureKey: 'failed_to_delete_note',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await noteService().deleteNote(userId, currentNoteId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback(
    (newSelection: string[]) => {
      setSelectedTagIds(newSelection);
    },
    [setSelectedTagIds],
  );

  const styles = StyleSheet.create({
    tagSection: {
      marginTop: 20,
      marginBottom: 10,
    },
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={isEditing ? t('edit_note_title') : t('create_note_title')}
      description={t('note_form_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {isEditing ? t('save_changes') : t('create_note')}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {t('delete_note_title')}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('title')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('title_placeholder')}
            value={title}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormField label={t('body')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('body_placeholder')}
            value={body || ''}
            onChangeText={setBody}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <CustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
      />

      <View style={styles.tagSection}>
        <MultiSelectPill
          options={availableTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color || colors.primaryContainer,
          }))}
          selectedValues={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_note')}
          label={t('note_tags')}
        />
      </View>
    </EntityFormContainer>
  );
};

export default NoteFormScreen;
