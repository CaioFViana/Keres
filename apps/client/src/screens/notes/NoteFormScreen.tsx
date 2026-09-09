import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import CustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { NotesStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useNoteFormActions } from './useNoteFormActions';
import { useNoteFormAssociations } from './useNoteFormAssociations';
import { useNoteFormResources } from './useNoteFormResources';
import { useNoteFormState } from './useNoteFormState';

type NoteFormScreenRouteProp = RouteProp<NotesStackParamList, 'NoteForm'>;
type NoteFormScreenNavigationProp = NativeStackNavigationProp<NotesStackParamList, 'NoteForm'>;

const styles = StyleSheet.create({
  tagSection: {
    marginTop: 20,
    marginBottom: 10,
  },
});

const NoteFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<NoteFormScreenNavigationProp>();
  const route = useRoute<NoteFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { noteId: initialNoteId } = route.params || {};
  const { selectedStory } = useStoryStore();
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'Note');

  const { drizzleDb, noteServiceRef } = useNoteFormResources();

  const noteFormState = useNoteFormState({
    initialNoteId,
    storyId: selectedStory?.id,
    drizzleDb,
    noteServiceRef,
    customFields,
  });
  const {
    title,
    setTitle,
    body,
    setBody,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  } = noteFormState;

  const { availableTags, selectedTagIds, persistTagRelations, handleTagSelectionChange } =
    useNoteFormAssociations({
      currentNoteId: noteFormState.currentNoteId,
    });

  const { deleting, handleDelete, handleSave, saving } = useNoteFormActions({
    state: noteFormState,
    customFields,
    drizzleDb,
    noteServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
  });

  const formTitle = isEditing ? t('edit_note_title') : t('create_note_title');

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
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
