import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import CustomAttributeFields, {
  validateRequiredCustomAttributes,
} from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import SceneCharacterManager from '@/src/components/features/characters/CharacterManager/SceneCharacterManager';
import EffectListEditor from '@/src/components/features/effects/EffectListEditor';
import SceneTimingFields from '@/src/components/features/scenes/SceneTimingFields';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { parseCalendarDateCoordinate } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityEffects } from '../../../hooks/useEntityEffects';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useSceneCharacterPresence } from '../../../hooks/useSceneCharacterPresence';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';

import {
  saveSceneWithRelations,
  type SceneFormData,
} from '../../../services/storymanagement/SceneSaveCoordinator';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { parseTimingInput } from '../../../utils/sceneTimingInput';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useSceneFormResources } from './useSceneFormResources';
import { useSceneFormState } from './useSceneFormState';

type SceneFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'SceneForm'>;
type SceneFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'SceneForm'
>;

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
  const confirmDelete = useConfirmDelete();
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);
  const isBranching = selectedStory?.type === 'branching';
  const customFields = useStorySchemaFields(selectedStory?.id, 'Scene');
  const {
    currentSceneId,
    setCurrentSceneId,
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
  } = useSceneFormState({
    initialSceneId,
    initialChapterId,
    storyId: selectedStory?.id,
    drizzleDb,
    sceneServiceRef,
    customFields,
  });

  const {
    characterSceneRelations,
    pendingCharacterSceneRelations,
    fetchCharacterSceneRelations,
    handleSaveCharacterSceneRelation,
    handleDeleteCharacterSceneRelation,
    persistPendingCharacterSceneRelations,
  } = useSceneCharacterPresence(currentSceneId, selectedStory?.id);
  const {
    effects: sceneEffects,
    handleAddEffect,
    handleUpdateEffect,
    handleChangeEffectType,
    handleDeleteEffect,
  } = useEntityEffects('Scene', currentSceneId, selectedStory?.id, isBranching);

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
  } = useEntityRelations({ entityType: 'Scene', entityId: currentSceneId });

  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    void fetchCharacterSceneRelations();
  }, [fetchCharacterSceneRelations]);

  const handleSave = () =>
    runSave(async () => {
      if (!name.trim()) {
        AppAlert.alert(t('error'), t('name_required'));
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

      const gap = parseTimingInput(gapInput);
      const duration = parseTimingInput(durationInput);
      if ((gapInput !== '' && gap === null) || (durationInput !== '' && duration === null)) {
        AppAlert.alert(t('error'), t('scene_timing_invalid'));
        return;
      }
      if (
        calendarDateOverride.trim() &&
        !parseCalendarDateCoordinate(calendarDateOverride.trim())
      ) {
        AppAlert.alert(t('error'), t('scene_fixed_date_invalid'));
        return;
      }

      try {
        const sceneData: SceneFormData = {
          chapterId: chapterId,
          locationId: locationId,
          name: name.trim(),
          summary,
          isFavorite,
          extraNotes,
          gap,
          gapType,
          calendarDateOverride: calendarDateOverride.trim() || null,
          calendarDateOverrideCalendarId: calendarDateOverride.trim()
            ? calendarDateOverrideCalendarId
            : null,
          duration,
          durationType,
          isStart,
          isFinish,
        };

        const { sceneId: savedSceneId, created } = await saveSceneWithRelations({
          sceneService: sceneServiceRef.current!,
          userId,
          storyId: selectedStory.id,
          currentSceneId,
          sceneData,
          notFoundMessage: copy.notFound,
          persistRelations: async (sceneId) => {
            await persistTagRelations(sceneId);
            await persistNoteRelations(sceneId);
            await seeAlsoManagerRef.current?.persistPending(sceneId);
            await persistPendingCharacterSceneRelations(sceneId);
          },
          persistCustomAttributes: (sceneId) =>
            createAttributeValueService(drizzleDb).saveValuesForEntity(
              userId,
              selectedStory.id,
              'Scene',
              sceneId,
              customValues,
            ),
        });
        if (created) setCurrentSceneId(savedSceneId);
        entityEventEmitter.emit('scene_changed', selectedStory.id, savedSceneId);

        AppAlert.alert(t('success'), isEditing ? copy.updated : copy.created);

        if (created) {
          navigation.dispatch(StackActions.replace('SceneForm', { sceneId: savedSceneId }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save scene:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    if (!currentSceneId || !sceneServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_scene_title',
      title: copy.deleteLabel,
      messageKey: 'delete_scene_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_scene',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await sceneServiceRef.current!.deleteScene(userId, currentSceneId);
        entityEventEmitter.emit('scene_changed', selectedStory?.id, currentSceneId);
        navigation.goBack();
      },
    });
  };

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
