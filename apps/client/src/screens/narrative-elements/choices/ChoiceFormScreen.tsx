import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
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
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../../hooks/useEntityFormSecondaryDraft';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import { useChoiceFormActions } from './useChoiceFormActions';
import { useChoiceFormAssociations } from './useChoiceFormAssociations';
import { useChoiceFormResources } from './useChoiceFormResources';
import { useChoiceFormState } from './useChoiceFormState';

type ChoiceFormScreenRouteProp = RouteProp<NarrativeElementsStackParamList, 'ChoiceForm'>;
type ChoiceFormScreenNavigationProp = NativeStackNavigationProp<
  NarrativeElementsStackParamList,
  'ChoiceForm'
>;

const styles = StyleSheet.create({
  noteSection: { marginTop: 20, marginBottom: -10 },
  tagSection: { marginTop: 20, marginBottom: 0 },
});

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
  const commonInputStyles = getCommonInputStyles(colors);
  const isBranching = selectedStory?.type === 'branching';

  const { choiceServiceRef, scenes, items } = useChoiceFormResources(selectedStory?.id);

  const choiceFormState = useChoiceFormState({
    initialChoiceId,
    initialSceneId,
    storyId: selectedStory?.id,
    choiceServiceRef,
  });
  const {
    currentChoiceId,
    sceneId,
    setSceneId,
    nextSceneId,
    setNextSceneId,
    text,
    setText,
    notes,
    setNotes,
    loading,
    isEditing,
  } = choiceFormState;

  const { checks, effects, relations } = useChoiceFormAssociations(
    currentChoiceId,
    selectedStory?.id,
    isBranching,
  );
  const {
    checkGroups,
    checks: choiceChecks,
    handleAddCheckGroup,
    handleUpdateCheckGroupCombinator,
    handleDeleteCheckGroup,
    handleAddCheck,
    handleUpdateCheck,
    handleDeleteCheck,
    handleChangeCheckType,
  } = checks;
  const {
    effects: choiceEffects,
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
    noteRelations: choiceNoteRelations,
    pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = relations;

  const getCustomValues = useCallback(() => ({}), []);
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'Choice',
    selectedTagIds,
    pendingNoteRelations,
    getCustomValues,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useChoiceFormActions({
    state: choiceFormState,
    choiceServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
    persistNoteRelations,
    persistSecondaryDraft,
    clearSecondaryDraft,
  });

  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

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
          checks={choiceChecks}
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
