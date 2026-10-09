import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import EntityFormActions from '@/src/components/common/forms/EntityFormActions/EntityFormActions';
import EntitySeeAlsoManager from '@/src/components/features/seealso/EntitySeeAlsoManager/EntitySeeAlsoManager';
import EntityNotesManager from '@/src/components/features/notes/EntityNotesManager/EntityNotesManager';
import EntityTagPicker from '@/src/components/features/tags/EntityTagPicker/EntityTagPicker';
import FormTextAreaField from '@/src/components/common/forms/FormTextAreaField/FormTextAreaField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ChoiceCheckGroupEditor from '@/src/components/features/choices/ChoiceCheckGroupEditor';
import EffectListEditor from '@/src/components/features/effects/EffectListEditor';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../../hooks/useEntityFormSecondaryDraft';
import { useFormResetHeaderAction } from '../../../hooks/useFormResetHeaderAction';
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
    isDirty,
    resetForm,
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

  const resetHeaderAction = useFormResetHeaderAction({ isEditing, isDirty, resetForm });

  useScreenHeader({
    target: 'parent',
    title: formTitle,
    actions: resetHeaderAction,
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
      <FormTextAreaField
        label={t('text')}
        placeholder={t('text_placeholder')}
        value={text}
        onChangeText={setText}
        style={commonInputStyles.multiline}
      />

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

      <FormTextAreaField
        label={t('choice_notes')}
        placeholder={t('choice_notes_placeholder')}
        value={notes}
        onChangeText={setNotes}
        style={commonInputStyles.multiline}
      />

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <EntityTagPicker
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            onSelectionChange={setSelectedTagIds}
            placeholder={t('select_tags_for_choice')}
            label={t('choice_tags')}
            defaultColor={colors.primaryContainer}
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
          <EntityNotesManager
            noteRelations={choiceNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            target={{
              storyId: selectedStory.id,
              entityType: 'Choice',
              entityId: currentChoiceId ?? '',
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
              entityType: 'Choice',
              entityId: currentChoiceId ?? '',
            }}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ChoiceFormScreen;
