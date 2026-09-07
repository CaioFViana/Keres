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
import SceneCharacterManager from '@/src/components/features/characters/CharacterManager/SceneCharacterManager';
import EffectListEditor from '@/src/components/features/effects/EffectListEditor';
import SceneTimingFields from '@/src/components/features/scenes/SceneTimingFields';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useSceneFormResources } from './useSceneFormResources';
import { useSceneFormActions } from './useSceneFormActions';
import { useSceneFormAssociations } from './useSceneFormAssociations';
import { useSceneFormState } from './useSceneFormState';

type SceneFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneForm'>;
type SceneFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'SceneForm'
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

const SceneFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<SceneFormScreenNavigationProp>();
  const route = useRoute<SceneFormScreenRouteProp>();
  const { sceneId: initialSceneId, chapterId: initialChapterId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Scene');
  const chapterCopy = useVocabularyEntityCopy('Chapter');
  const locationCopy = useVocabularyEntityCopy('Location');
  const itemCopy = useVocabularyEntityCopy('Item');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const { calendars } = useStoryCalendar(selectedStory?.id);
  const {
    drizzleDb,
    sceneServiceRef,
    chapters,
    locations,
    characters,
    items,
  } = useSceneFormResources(selectedStory?.id);

  const commonInputStyles = getCommonInputStyles(colors);
  const isBranching = selectedStory?.type === 'branching';
  const customFields = useStorySchemaFields(selectedStory?.id, 'Scene');
  const sceneFormState = useSceneFormState({
    initialSceneId,
    initialChapterId,
    storyId: selectedStory?.id,
    drizzleDb,
    sceneServiceRef,
    customFields,
  });
  const {
    currentSceneId,
    chapterId,
    setChapterId,
    locationId,
    setLocationId,
    name,
    setName,
    summary,
    setSummary,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    gapInput,
    setGapInput,
    gapType,
    setGapType,
    calendarDateOverride,
    setCalendarDateOverride,
    calendarDateOverrideCalendarId,
    setCalendarDateOverrideCalendarId,
    durationInput,
    setDurationInput,
    durationType,
    setDurationType,
    isStart,
    setIsStart,
    isFinish,
    setIsFinish,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  } = sceneFormState;

  const { characterPresence, effects, relations } = useSceneFormAssociations(
    currentSceneId,
    selectedStory?.id,
    isBranching,
  );
  const {
    characterSceneRelations,
    pendingCharacterSceneRelations,
    handleSaveCharacterSceneRelation,
    handleDeleteCharacterSceneRelation,
    persistPendingCharacterSceneRelations,
  } = characterPresence;
  const {
    effects: sceneEffects,
    handleAddEffect,
    handleUpdateEffect,
    handleChangeEffectType,
    handleDeleteEffect,
  } = effects;

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: sceneNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = relations;

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useSceneFormActions({
    state: sceneFormState,
    customFields,
    drizzleDb,
    sceneServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
    persistNoteRelations,
    persistCharacterRelations: persistPendingCharacterSceneRelations,
  });
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  const chapterOptions = useMemo(
    () => chapters.map((chapter) => ({ label: chapter.name, value: chapter.id })),
    [chapters],
  );
  const locationOptions = useMemo(
    () => locations.map((location) => ({ label: location.name, value: location.id })),
    [locations],
  );
  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );
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
      <FormField label={chapterCopy.entity}>
        <SingleSelectPill
          options={chapterOptions}
          value={chapterId}
          onValueChange={setChapterId}
          placeholder={chapterCopy.selectOptional}
          multiple={false}
          allowDeselect
        />
      </FormField>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
        {t('scene_chapter_optional_hint')}
      </Text>

      {/*
        Optional since 1.6. An era, a war, a rumour heard in three cities is a scene with no single
        place, and requiring one was Keres deciding something about the story on the writer's
        behalf. `allowDeselect` is what lets them take it back off.
      */}
      <FormField label={locationCopy.entity} help={t('scene_location_optional_hint')}>
        <SingleSelectPill
          options={locationOptions}
          value={locationId}
          onValueChange={setLocationId}
          placeholder={locationCopy.selectOptional}
          multiple={false}
          allowDeselect
        />
      </FormField>

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

      <SceneTimingFields
        gapInput={gapInput}
        onGapInputChange={setGapInput}
        gapType={gapType}
        onGapTypeChange={setGapType}
        durationInput={durationInput}
        onDurationInputChange={setDurationInput}
        durationType={durationType}
        onDurationTypeChange={setDurationType}
        calendarDateOverride={calendarDateOverride}
        onCalendarDateOverrideChange={setCalendarDateOverride}
        calendarDateOverrideCalendarId={calendarDateOverrideCalendarId}
        onCalendarDateOverrideCalendarIdChange={setCalendarDateOverrideCalendarId}
        calendars={calendars}
        inputStyle={commonInputStyles.input}
      />

      <FormSwitchField label={t('is_start_scene')} value={isStart} onValueChange={setIsStart} />

      <FormSwitchField label={t('is_finish_scene')} value={isFinish} onValueChange={setIsFinish} />
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
            onSelectionChange={setSelectedTagIds}
            placeholder={t('select_tags_for_scene')}
            label={t('scene_tags')}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <SceneCharacterManager
            characterRelations={
              currentSceneId ? characterSceneRelations : pendingCharacterSceneRelations
            }
            availableCharacters={characters.filter((char) => !char.isDeleted)}
            onSave={handleSaveCharacterSceneRelation}
            onDelete={handleDeleteCharacterSceneRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentSceneId={currentSceneId ?? ''}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={sceneNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentSceneId ?? ''}
            currentEntityType="Scene"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Scene"
            entityId={currentSceneId ?? ''}
            editable={true}
          />
        </View>
      )}

      {currentSceneId && selectedStory?.id && isBranching && (
        <EffectListEditor
          effects={sceneEffects}
          itemOptions={itemOptions}
          itemLabel={itemCopy.entity}
          inputStyle={commonInputStyles.input}
          onChangeType={handleChangeEffectType}
          onUpdate={handleUpdateEffect}
          onDelete={handleDeleteEffect}
          onAdd={handleAddEffect}
        />
      )}
    </EntityFormContainer>
  );
};

export default SceneFormScreen;
