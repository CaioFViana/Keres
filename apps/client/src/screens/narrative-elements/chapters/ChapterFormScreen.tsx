import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import EntityFormActions from '@/src/components/common/forms/EntityFormActions/EntityFormActions';
import EntityCustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/EntityCustomAttributeFields';
import EntitySeeAlsoManager from '@/src/components/features/seealso/EntitySeeAlsoManager/EntitySeeAlsoManager';
import EntityNotesManager from '@/src/components/features/notes/EntityNotesManager/EntityNotesManager';
import EntityTagPicker from '@/src/components/features/tags/EntityTagPicker/EntityTagPicker';
import FormTextAreaField from '@/src/components/common/forms/FormTextAreaField/FormTextAreaField';
import FormTextField from '@/src/components/common/forms/FormTextField/FormTextField';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import AnchorManager from '@/src/components/features/chapters/AnchorManager/AnchorManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../../hooks/useEntityFormSecondaryDraft';
import { useEntityFormHeader } from '@/src/hooks/useEntityFormHeader';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useStoryVocabulary } from '../../../vocabulary/useStoryVocabulary';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useChapterFormActions } from './useChapterFormActions';
import { useChapterFormAssociations } from './useChapterFormAssociations';
import { useChapterFormResources } from './useChapterFormResources';
import { useChapterFormState } from './useChapterFormState';

type ChapterFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'ChapterForm'>;
type ChapterFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'ChapterForm'
>;

const styles = StyleSheet.create({
  noteSection: {
    marginTop: 20,
    marginBottom: -10,
  },
  tagSection: {
    marginTop: 20,
    marginBottom: 0,
  },
});

const ChapterFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChapterFormScreenNavigationProp>();
  const route = useRoute<ChapterFormScreenRouteProp>();
  const { chapterId: initialChapterId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory, activeArcId } = useStoryStore();
  const vocab = useStoryVocabulary();
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'Chapter');

  const { drizzleDb, chapterServiceRef } = useChapterFormResources();

  const chapterFormState = useChapterFormState({
    initialChapterId,
    storyId: selectedStory?.id,
    activeArcId,
    drizzleDb,
    chapterServiceRef,
    customFields,
  });
  const {
    currentChapterId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    isEvent,
    setIsEvent,
    extraNotes,
    setExtraNotes,
    arcId,
    setArcId,
    customValues,
    setCustomValues,
    loading,
    isEditing,
    isDirty,
    resetForm,
  } = chapterFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    chapterNoteRelations,
    pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    handleTagSelectionChange,
    arcs,
  } = useChapterFormAssociations({
    currentChapterId,
    isEditing,
    storyId: selectedStory?.id,
    drizzleDb,
    setArcId,
  });

  const getCustomValues = useCallback(
    () => chapterFormState.customValues,
    [chapterFormState.customValues],
  );
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'Chapter',
    selectedTagIds,
    pendingNoteRelations,
    getCustomValues,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useChapterFormActions({
    state: chapterFormState,
    customFields,
    drizzleDb,
    chapterServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
    persistNoteRelations,
    persistSecondaryDraft,
    clearSecondaryDraft,
  });

  const copy = useVocabularyEntityCopy(isEvent ? 'Event' : 'Chapter');
  const arcCopy = useVocabularyEntityCopy('Arc');
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useEntityFormHeader({ title: formTitle, isEditing, isDirty, resetForm });

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={copy.formDescription}
      actions={
        <EntityFormActions
          isEditing={isEditing}
          busy={saving || deleting}
          colors={colors}
          deleteLabel={copy.deleteLabel}
          saveLabel={copy.saveLabel}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      }
    >
      <FormTextField
        label={t('name')}
        placeholder={t('name_placeholder')}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      {arcs.length > 1 ? (
        <FormField label={vocab.term('Arc')}>
          <SingleSelectPill
            options={arcs.map((arc) => ({
              label: arc.title,
              value: arc.id,
              color: arc.color,
            }))}
            value={arcId}
            onValueChange={setArcId}
            placeholder={arcCopy.select}
            allowDeselect={false}
          />
        </FormField>
      ) : null}

      <FormTextAreaField
        label={t('summary')}
        placeholder={t('summary_placeholder')}
        value={summary}
        onChangeText={setSummary}
        style={commonInputStyles.multiline}
      />

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      {/*
        Only while creating. Changing the kind afterwards moves the container between two index
        spaces and rewrites both - see `ConvertContainerModal` on the detail screen.
      */}
      {!isEditing && (
        <>
          <FormSwitchField
            label={t('chapter_is_event')}
            value={isEvent}
            onValueChange={setIsEvent}
            testID="chapter-is-event"
          />
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 5 }}>
            {t('chapter_is_event_hint')}
          </Text>
        </>
      )}

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

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <EntityTagPicker
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            placeholder={t('select_tags_for_chapter')}
            label={t('chapter_tags')}
            defaultColor={colors.primaryContainer}
          />
        </View>
      )}

      {currentChapterId && selectedStory?.id && (
        <View style={styles.noteSection}>
          <AnchorManager
            storyId={selectedStory.id}
            chapterId={currentChapterId}
            currentUserId={userId}
            editable={true}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <EntityNotesManager
            noteRelations={chapterNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            target={{
              storyId: selectedStory.id,
              entityType: 'Chapter',
              entityId: currentChapterId ?? '',
            }}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <EntitySeeAlsoManager
            managerRef={seeAlsoManagerRef}
            target={{
              storyId: selectedStory.id,
              entityType: 'Chapter',
              entityId: currentChapterId ?? '',
            }}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ChapterFormScreen;
