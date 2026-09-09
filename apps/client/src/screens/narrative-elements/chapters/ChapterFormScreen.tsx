import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import CustomAttributeFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import AnchorManager from '@/src/components/features/chapters/AnchorManager/AnchorManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
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
  } = chapterFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    chapterNoteRelations,
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
  });

  const copy = useVocabularyEntityCopy(isEvent ? 'Event' : 'Chapter');
  const arcCopy = useVocabularyEntityCopy('Arc');
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

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
      description={copy.formDescription}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {copy.saveLabel}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {copy.deleteLabel}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

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

      <FormField label={t('summary')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('summary_placeholder')}
            value={summary || ''}
            onChangeText={setSummary}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

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

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <MultiSelectPill
            options={availableTags.map((tag) => ({
              label: tag.name,
              value: tag.id,
              color: tag.color || colors.primaryContainer,
            }))}
            selectedValues={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            placeholder={t('select_tags_for_chapter')}
            label={t('chapter_tags')}
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
          <NoteManager
            noteRelations={chapterNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentChapterId ?? ''}
            currentEntityType="Chapter"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Chapter"
            entityId={currentChapterId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ChapterFormScreen;
