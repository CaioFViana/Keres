import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import EntityFormActions from '@/src/components/common/forms/EntityFormActions/EntityFormActions';
import EntityCustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/EntityCustomAttributeFields';
import EntityTagPicker from '@/src/components/features/tags/EntityTagPicker/EntityTagPicker';
import FormTextAreaField from '@/src/components/common/forms/FormTextAreaField/FormTextAreaField';
import FormTextField from '@/src/components/common/forms/FormTextField/FormTextField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../hooks/useEntityFormSecondaryDraft';
import { useFormResetHeaderAction } from '../../hooks/useFormResetHeaderAction';
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
    isDirty,
    resetForm,
  } = noteFormState;

  const { availableTags, selectedTagIds, persistTagRelations, handleTagSelectionChange } =
    useNoteFormAssociations({
      currentNoteId: noteFormState.currentNoteId,
    });

  const getCustomValues = useCallback(
    () => noteFormState.customValues,
    [noteFormState.customValues],
  );
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'Note',
    selectedTagIds,
    pendingNoteRelations: [],
    getCustomValues,
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
    persistSecondaryDraft,
    clearSecondaryDraft,
  });

  const formTitle = isEditing ? t('edit_note_title') : t('create_note_title');

  const resetHeaderAction = useFormResetHeaderAction({ isEditing, isDirty, resetForm });

  useScreenHeader({
    target: 'parent',
    title: formTitle,
    actions: resetHeaderAction,
  });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={t('note_form_description')}
      actions={
        <EntityFormActions
          isEditing={isEditing}
          busy={saving || deleting}
          colors={colors}
          deleteLabel={t('delete_note_title')}
          saveLabel={isEditing ? t('save_changes') : t('create_note')}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      }
    >
      <FormTextField
        label={t('title')}
        placeholder={t('title_placeholder')}
        value={title}
        onChangeText={setTitle}
        style={commonInputStyles.input}
      />

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormTextAreaField
        label={t('body')}
        placeholder={t('body_placeholder')}
        value={body}
        onChangeText={setBody}
        style={commonInputStyles.multiline}
      />

      <FormTextAreaField
        label={t('extra_notes')}
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes}
        onChangeText={setExtraNotes}
        style={commonInputStyles.multiline}
      />

      <EntityCustomAttributeFields
        storyId={selectedStory?.id || ''}
        fields={customFields}
        values={customValues}
        setValues={setCustomValues}
      />

      <View style={styles.tagSection}>
        <EntityTagPicker
          tags={availableTags}
          selectedTagIds={selectedTagIds}
          onSelectionChange={handleTagSelectionChange}
          placeholder={t('select_tags_for_note')}
          label={t('note_tags')}
          defaultColor={colors.primaryContainer}
        />
      </View>
    </EntityFormContainer>
  );
};

export default NoteFormScreen;
