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
import type { Scene } from '@keres/shared/entities/Scene';
import { parseCalendarDateCoordinate } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityEffects } from '../../../hooks/useEntityEffects';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useSceneCharacterPresence } from '../../../hooks/useSceneCharacterPresence';
import { useStoryCalendar } from '../../../hooks/useStoryCalendar';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createAttributeValueService } from '../../../services/storymanagement/AttributeValueService';

import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useChapterStore } from '../../../state/chapterStore'; // Import useChapterStore
import { useCharacterStore } from '../../../state/characterStore'; // Import useCharacterStore
import { useItemStore } from '../../../state/itemStore';
import { useLocationStore } from '../../../state/locationStore'; // Import useLocationStore
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { parseTimingInput } from '../../../utils/sceneTimingInput';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';

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
    chapters,
    fetchChapters,
    setDbAndStoryId: setChapterDbAndStoryId,
    initializeService: initializeChapterService,
  } = useChapterStore(); // For chapter selection
  const {
    locations,
    fetchLocations,
    setDbAndStoryId: setLocationDbAndStoryId,
    initializeService: initializeLocationService,
  } = useLocationStore(); // For location selection
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore(); // For character selection
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  const isBranching = selectedStory?.type === 'branching';

  useEffect(() => {
    if (drizzleDb) {
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (!drizzleDb || !selectedStory?.id) return;
    setItemDbAndStoryId(drizzleDb, selectedStory.id);
    initializeItemService();
    fetchItems();
    setChapterDbAndStoryId(drizzleDb, selectedStory.id);
    initializeChapterService();
    fetchChapters();
    setLocationDbAndStoryId(drizzleDb, selectedStory.id);
    initializeLocationService();
    fetchLocations();
    setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
    initializeCharacterService();
    fetchCharacters();
  }, [
    drizzleDb,
    selectedStory?.id,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
    setChapterDbAndStoryId,
    initializeChapterService,
    fetchChapters,
    setLocationDbAndStoryId,
    initializeLocationService,
    fetchLocations,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);
  const [chapterId, setChapterId] = useState<string | null>(null); // State for selected chapter
  const [locationId, setLocationId] = useState<string | null>(null); // State for selected location
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [gapInput, setGapInput] = useState('');
  const [gapType, setGapType] = useState<string | null>(null); // e.g., 'seconds', 'minutes', 'hours'
  const [calendarDateOverride, setCalendarDateOverride] = useState('');
  const [calendarDateOverrideCalendarId, setCalendarDateOverrideCalendarId] = useState<
    string | null
  >(null);
  const [durationInput, setDurationInput] = useState('');
  const [durationType, setDurationType] = useState<string | null>(null); // e.g., 'seconds', 'minutes', 'hours'
  const [isStart, setIsStart] = useState(false);
  const [isFinish, setIsFinish] = useState(false);

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

  const customFields = useStorySchemaFields(selectedStory?.id, 'Scene');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentSceneId;
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    const loadSceneAndData = async () => {
      if (!sceneServiceRef.current || !selectedStory?.id) {
        console.warn('Scene service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedScene = await sceneServiceRef.current.getById(currentSceneId!);
          if (fetchedScene) {
            setChapterId(fetchedScene.chapterId);
            setLocationId(fetchedScene.locationId); // Set locationId
            setName(fetchedScene.name);
            setSummary(fetchedScene.summary);
            setIsFavorite(fetchedScene.isFavorite);
            setExtraNotes(fetchedScene.extraNotes);
            setGapInput(fetchedScene.gap === null ? '' : String(fetchedScene.gap));
            setGapType(fetchedScene.gapType);
            setCalendarDateOverride(fetchedScene.calendarDateOverride ?? '');
            setCalendarDateOverrideCalendarId(fetchedScene.calendarDateOverrideCalendarId);
            setDurationInput(fetchedScene.duration === null ? '' : String(fetchedScene.duration));
            setDurationType(fetchedScene.durationType);
            setIsStart(fetchedScene.isStart);
            setIsFinish(fetchedScene.isFinish);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentSceneId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Scene not found:', currentSceneId);
          }
        } else if (initialChapterId) {
          setChapterId(initialChapterId);
        }
      } catch (err) {
        console.error('Failed to load scene:', err);
      } finally {
        setLoading(false);
        fetchCharacterSceneRelations(); // Fetch character-scene relations
      }
    };
    loadSceneAndData();
  }, [
    currentSceneId,
    drizzleDb,
    fetchCharacterSceneRelations,
    initialChapterId,
    isEditing,
    selectedStory?.id,
    t,
  ]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

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
        const sceneData: Omit<
          Scene,
          | 'id'
          | 'storyId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
          | 'index'
        > = {
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

        let savedSceneId: string | undefined = currentSceneId;

        if (isEditing && currentSceneId) {
          const originalScene = await sceneServiceRef.current!.getById(currentSceneId);
          if (!originalScene) {
            throw new Error(copy.notFound);
          }

          // Changing chapter (the position in the new queue and closing the hole in the old one) is the
          // service's responsibility: here the screen only says which chapter the scene is going to.
          const savedScene = await sceneServiceRef.current!.updateScene(
            userId,
            currentSceneId,
            sceneData,
          );
          savedSceneId = savedScene.id;
          AppAlert.alert(t('success'), copy.updated);
        } else {
          // --- CREATE NEW SCENE LOGIC ---
          const allScenesInChapter = (
            await sceneServiceRef.current!.getAllByStoryId(selectedStory.id)
          ).filter((scn) => scn.chapterId === chapterId);
          // A chapter's first scene is 1, and not 0: the same convention as the chapters and the only one
          // the API accepts when those scenes are reordered later.
          const nextIndex =
            allScenesInChapter.length > 0
              ? Math.max(...allScenesInChapter.map((scn) => scn.index || 0)) + 1
              : 1;
          const savedScene = await sceneServiceRef.current!.createScene(userId, {
            ...sceneData,
            storyId: selectedStory.id,
            index: nextIndex,
          });
          savedSceneId = savedScene.id;
          setCurrentSceneId(savedScene.id);
          AppAlert.alert(t('success'), copy.created);
        }

        if (savedSceneId) {
          await persistTagRelations(savedSceneId);
          await persistNoteRelations(savedSceneId);
          await seeAlsoManagerRef.current?.persistPending(savedSceneId);
          await persistPendingCharacterSceneRelations(savedSceneId);
          await createAttributeValueService(drizzleDb).saveValuesForEntity(
            userId,
            selectedStory.id,
            'Scene',
            savedSceneId,
            customValues,
          );
          entityEventEmitter.emit('scene_changed', selectedStory.id, savedSceneId);
        }

        if (!isEditing && savedSceneId) {
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
      {/* End New Scene Fields */}

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
