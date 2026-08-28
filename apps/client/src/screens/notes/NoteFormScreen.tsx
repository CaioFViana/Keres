import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { Note } from '@keres/shared/entities/Note';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { NotesStackParamList } from '../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createNoteService } from '../../services/storymanagement/NoteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';

type NoteFormScreenRouteProp = RouteProp<NotesStackParamList, 'NoteForm'>;

const NoteFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<NoteFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { noteId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const noteService = useCallback(() => createNoteService(drizzleDb), [drizzleDb]);
  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  // Notes can't be attached to other notes, so only the tag half of the hook applies.
  const { availableTags, selectedTagIds, setSelectedTagIds, persistTagRelations } =
    useEntityRelations({ entityType: 'Note', entityId: noteId, withNotes: false });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Note');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!noteId;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_note_title') : t('create_note_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_note_title') : t('create_note_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t]),
  );

  useEffect(() => {
    const loadNote = async () => {
      if (!isEditing) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedNote = await noteService().getById(noteId!);
        if (fetchedNote) {
          setTitle(fetchedNote.title);
          setBody(fetchedNote.body);
          setIsFavorite(fetchedNote.isFavorite);
          setExtraNotes(fetchedNote.extraNotes);

          const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
            noteId!,
          );
          setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
        } else {
          console.warn('Note not found:', noteId);
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNote();
  }, [drizzleDb, noteId, isEditing, noteService, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
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

    setLoading(true);

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

      let currentNoteId = noteId;

      if (isEditing) {
        await noteService().updateNote(userId, noteId!, noteData);
        AppAlert.alert(t('success'), t('note_updated_successfully'));
      } else {
        const newNote = await noteService().createNote(userId, {
          ...noteData,
          storyId: selectedStory.id,
        });
        AppAlert.alert(t('success'), t('note_created_successfully'));
        currentNoteId = newNote.id; // Get the ID of the newly created note
      }

      if (currentNoteId) {
        await persistTagRelations(currentNoteId);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(
          userId,
          selectedStory.id,
          'Note',
          currentNoteId,
          customValues,
        );
      }

      navigation.goBack();
    } catch (err) {
      console.error('Failed to save note:', err);
      AppAlert.alert(t('error'), t('failed_to_save_note'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!noteId) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_note_title',
      messageKey: 'delete_note_message',
      successKey: 'note_deleted_successfully',
      failureKey: 'failed_to_delete_note',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await noteService().deleteNote(userId, noteId);
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
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    tagSection: {
      marginTop: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {isEditing ? t('edit_note_title') : t('create_note_title')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
        {t('note_form_description')}
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
      <TextInput
        placeholder={t('title_placeholder')}
        value={title}
        onChangeText={setTitle}
        style={commonInputStyles.input}
      />

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={setIsFavorite}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

      <Text style={[styles.label, { color: colors.text }]}>{t('body')}</Text>
      <TextInput
        placeholder={t('body_placeholder')}
        value={body || ''}
        onChangeText={setBody}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
        onChangeText={setExtraNotes}
        style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
        multiline
      />

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

      <FormActions stackOnCompact style={styles.saveButton}>
        <Button onPress={handleSave}>{isEditing ? t('save_changes') : t('create_note')}</Button>
        {isEditing && (
          <Button onPress={handleDelete} style={{ backgroundColor: colors.error }}>
            {t('delete_note_title')}
          </Button>
        )}
      </FormActions>
    </KeyboardAwareScreen>
  );
};

export default NoteFormScreen;
