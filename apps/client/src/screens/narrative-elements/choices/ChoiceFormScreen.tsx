import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import MultiSelectPill, {
  SingleSelectPill,
} from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ChoiceCheckGroupEditor from '@/src/components/features/choices/ChoiceCheckGroupEditor';
import EffectListEditor from '@/src/components/features/effects/EffectListEditor';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { Choice } from '@keres/shared/entities/Choice';
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../../db';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useChoiceChecks } from '../../../hooks/useChoiceChecks';
import { useConfirmDelete } from '../../../hooks/useConfirmDelete';
import { useEntityEffects } from '../../../hooks/useEntityEffects';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { useItemStore } from '../../../state/itemStore';
import { useSceneStore } from '../../../state/sceneStore';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { AppAlert } from '../../../utils/AppAlert';
import { entityEventEmitter } from '../../../utils/EventEmitter';

type ChoiceFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'ChoiceForm'>;
type ChoiceFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'ChoiceForm'
>;

const ChoiceFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChoiceFormScreenNavigationProp>();
  const route = useRoute<ChoiceFormScreenRouteProp>();
  const { choiceId: initialChoiceId, sceneId: initialSceneId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Choice');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  const isBranching = selectedStory?.type === 'branching';

  useEffect(() => {
    if (drizzleDb) {
      if (!choiceServiceRef.current) {
        choiceServiceRef.current = createChoiceService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();

      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
  ]);

  const [currentChoiceId, setCurrentChoiceId] = useState<string | undefined>(initialChoiceId);
  const [sceneId, setSceneId] = useState<string | null>(initialSceneId ?? null);
  const [nextSceneId, setNextSceneId] = useState<string | null>(null);
  const [text, setText] = useState(''); // Changed from description
  const [notes, setNotes] = useState<string | null>(null);
  const {
    checkGroups,
    checks,
    handleAddCheckGroup,
    handleUpdateCheckGroupCombinator,
    handleDeleteCheckGroup,
    handleAddCheck,
    handleUpdateCheck,
    handleDeleteCheck,
    handleChangeCheckType,
  } = useChoiceChecks(currentChoiceId, selectedStory?.id, isBranching);
  const {
    effects: choiceEffects,
    handleAddEffect,
    handleUpdateEffect,
    handleChangeEffectType,
    handleDeleteEffect,
  } = useEntityEffects('Choice', currentChoiceId, selectedStory?.id, isBranching);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: choiceNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Choice', entityId: currentChoiceId });

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentChoiceId;
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    const loadChoice = async () => {
      if (!choiceServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedChoice = await choiceServiceRef.current.getById(currentChoiceId!);
          if (fetchedChoice) {
            setSceneId(fetchedChoice.sceneId);
            setNextSceneId(fetchedChoice.nextSceneId);
            setText(fetchedChoice.text); // Use text
            setNotes(fetchedChoice.notes);
          } else {
            console.warn('Choice not found:', currentChoiceId);
          }
        }
      } catch (err) {
        console.error('Failed to load choice:', err);
      } finally {
        setLoading(false);
      }
    };
    loadChoice();
  }, [currentChoiceId, isEditing, selectedStory?.id, t]);

  const handleSave = () =>
    runSave(async () => {
      if (!text.trim()) {
        AppAlert.alert(t('error'), t('text_required')); // Use text_required
        return;
      }
      if (!sceneId) {
        AppAlert.alert(t('error'), sceneCopy.required);
        return;
      }
      if (!nextSceneId) {
        AppAlert.alert(t('error'), t('next_scene_required'));
        return;
      }
      if (!userId || !selectedStory?.id) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }

      try {
        const choiceData: Omit<
          Choice,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          sceneId: sceneId,
          nextSceneId: nextSceneId,
          text: text.trim(), // Use text
          notes: notes && notes.trim() ? notes.trim() : null,
        };

        let savedChoiceId: string | undefined = currentChoiceId;

        if (isEditing && currentChoiceId) {
          const savedChoice = await choiceServiceRef.current!.updateChoice(
            userId,
            currentChoiceId,
            choiceData,
          );
          savedChoiceId = savedChoice.id;
          AppAlert.alert(t('success'), copy.updated);
        } else {
          const savedChoice = await choiceServiceRef.current!.createChoice(userId, {
            ...choiceData,
            storyId: selectedStory.id,
          });
          savedChoiceId = savedChoice.id;
          setCurrentChoiceId(savedChoice.id);
          AppAlert.alert(t('success'), copy.created);
        }

        if (savedChoiceId) {
          await persistTagRelations(savedChoiceId);
          await persistNoteRelations(savedChoiceId);
          await seeAlsoManagerRef.current?.persistPending(savedChoiceId);
        }
        entityEventEmitter.emit('choice_changed', selectedStory.id, savedChoiceId);

        if (!isEditing && savedChoiceId) {
          navigation.dispatch(StackActions.replace('ChoiceForm', { choiceId: savedChoiceId }));
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save choice:', err);
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentChoiceId || !choiceServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_choice_title',
      title: copy.deleteLabel,
      messageKey: 'delete_choice_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_choice',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await choiceServiceRef.current!.deleteChoice(userId, currentChoiceId);
        entityEventEmitter.emit('choice_changed', selectedStory?.id, currentChoiceId);
        navigation.goBack();
      },
    });
  };

  const sceneOptions = useMemo(
    () => scenes.map((scene) => ({ label: scene.name, value: scene.id })),
    [scenes],
  );
  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );

  const checkTypeOptions = useMemo(
    () => [
      { label: t('check_type_scene_count'), value: 'sceneCount' },
      { label: t('check_type_inventory'), value: 'inventory' },
      { label: t('check_type_trigger'), value: 'trigger' },
    ],
    [t],
  );

  const checkModeOptions = useMemo(
    () => [
      { label: t('check_mode_block'), value: 'block' },
      { label: t('check_mode_enable'), value: 'enable' },
    ],
    [t],
  );

  const combinatorOptions = useMemo(
    () => [
      { label: t('combinator_and'), value: 'AND' },
      { label: t('combinator_or'), value: 'OR' },
    ],
    [t],
  );

  const itemPresenceOptions = useMemo(
    () => [
      { label: t('item_presence_has'), value: 'has' },
      { label: t('item_presence_lacks'), value: 'lacks' },
    ],
    [t],
  );

  const triggerStateOptions = useMemo(
    () => [
      { label: t('trigger_state_set'), value: 'set' },
      { label: t('trigger_state_unset'), value: 'unset' },
    ],
    [t],
  );

  const styles = StyleSheet.create({
    noteSection: { marginTop: 20, marginBottom: -10 },
    tagSection: { marginTop: 20, marginBottom: 0 },
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
      <FormField label={t('text')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('text_placeholder')}
            value={text}
            onChangeText={setText}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('vocabulary_parent_entity', { entity: sceneCopy.entity })}>
        <SingleSelectPill
          options={sceneOptions}
          value={sceneId}
          onValueChange={setSceneId}
          placeholder={sceneCopy.select}
          multiple={false}
        />
      </FormField>

      <FormField label={t('vocabulary_next_entity', { entity: sceneCopy.entity })}>
        <SingleSelectPill
          options={sceneOptions}
          value={nextSceneId}
          onValueChange={setNextSceneId}
          placeholder={sceneCopy.select}
          multiple={false}
        />
      </FormField>

      <FormField label={t('choice_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('choice_notes_placeholder')}
            value={notes || ''}
            onChangeText={setNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

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
            placeholder={t('select_tags_for_choice')}
            label={t('choice_tags')}
          />
        </View>
      )}

      {currentChoiceId && selectedStory?.id && isBranching && (
        <ChoiceCheckGroupEditor
          checkGroups={checkGroups}
          checks={checks}
          combinatorOptions={combinatorOptions}
          checkTypeOptions={checkTypeOptions}
          checkModeOptions={checkModeOptions}
          sceneOptions={sceneOptions}
          itemOptions={itemOptions}
          itemPresenceOptions={itemPresenceOptions}
          triggerStateOptions={triggerStateOptions}
          scenePlaceholder={sceneCopy.select}
          inputStyle={commonInputStyles.input}
          onUpdateCombinator={handleUpdateCheckGroupCombinator}
          onDeleteGroup={handleDeleteCheckGroup}
          onAddGroup={handleAddCheckGroup}
          onChangeCheckType={handleChangeCheckType}
          onUpdateCheck={handleUpdateCheck}
          onDeleteCheck={handleDeleteCheck}
          onAddCheck={handleAddCheck}
        />
      )}

      {currentChoiceId && selectedStory?.id && isBranching && (
        <EffectListEditor
          effects={choiceEffects}
          itemOptions={itemOptions}
          itemLabel={t('check_item')}
          inputStyle={commonInputStyles.input}
          onChangeType={handleChangeEffectType}
          onUpdate={handleUpdateEffect}
          onDelete={handleDeleteEffect}
          onAdd={handleAddEffect}
        />
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={choiceNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentChoiceId ?? ''}
            currentEntityType="Choice"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Choice"
            entityId={currentChoiceId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ChoiceFormScreen;
