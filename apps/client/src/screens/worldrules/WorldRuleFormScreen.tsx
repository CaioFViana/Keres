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
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { WORLD_PIECE_SECTIONS, type WorldPieceSection } from '@keres/shared/entities/WorldRule';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { WorldRulesStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useWorldRuleFormActions } from './useWorldRuleFormActions';
import { useWorldRuleFormAssociations } from './useWorldRuleFormAssociations';
import { useWorldRuleFormResources } from './useWorldRuleFormResources';
import { useWorldRuleFormState } from './useWorldRuleFormState';

type WorldRuleFormScreenRouteProp = RouteProp<WorldRulesStackParamList, 'WorldRuleForm'>;
type WorldRuleFormScreenNavigationProp = NativeStackNavigationProp<
  WorldRulesStackParamList,
  'WorldRuleForm'
>;

const styles = StyleSheet.create({
  tagSection: {
    marginTop: 20,
    marginBottom: 0,
  },
  noteSection: {
    marginTop: 20,
    marginBottom: -10,
  },
});

const WorldRuleFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<WorldRuleFormScreenNavigationProp>();
  const route = useRoute<WorldRuleFormScreenRouteProp>();
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('WorldRule');
  const { userId } = useUserSettingsStore();
  const { worldRuleId: initialWorldRuleId } = route.params || {};
  const { selectedStory } = useStoryStore();
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'WorldRule');

  const { drizzleDb, worldRuleServiceRef } = useWorldRuleFormResources();

  const worldRuleFormState = useWorldRuleFormState({
    initialWorldRuleId,
    storyId: selectedStory?.id,
    drizzleDb,
    worldRuleServiceRef,
    customFields,
  });
  const {
    currentWorldRuleId,
    title,
    setTitle,
    description,
    setDescription,
    section,
    setSection,
    type,
    setType,
    category,
    setCategory,
    behavior,
    setBehavior,
    usability,
    setUsability,
    danger,
    setDanger,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  } = worldRuleFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    worldRuleNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    handleTagSelectionChange,
  } = useWorldRuleFormAssociations({
    currentWorldRuleId,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useWorldRuleFormActions(
    {
      state: worldRuleFormState,
      customFields,
      drizzleDb,
      worldRuleServiceRef,
      navigation,
      storyId: selectedStory?.id,
      userId,
      persistTagRelations,
      persistNoteRelations,
    },
  );

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
      <FormField label={t('title')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_rule_title_placeholder')}
            value={title}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('world_piece_section')}>
        <SingleSelectPill
          options={WORLD_PIECE_SECTIONS.map((value) => ({
            value,
            label: t(`world_piece_section_${value}`),
          }))}
          value={section}
          onValueChange={(next) => {
            const nextSection = (next ?? 'rule') as WorldPieceSection;
            if (nextSection !== section && type) setType(null);
            setSection(nextSection);
          }}
          placeholder={t('world_piece_section')}
          multiple={false}
        />
      </FormField>

      <FormField label={t('world_piece_type')}>
        <SuggestionTextInput
          placeholder={t('world_piece_type_placeholder')}
          value={type || ''}
          onChangeText={setType}
          type={`world_piece_type:${section}`}
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_rule_description_placeholder')}
            value={description || ''}
            onChangeText={setDescription}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('category')}>
        <SuggestionTextInput
          placeholder={t('category_placeholder')}
          value={category || ''}
          onChangeText={setCategory}
          type="world_piece_category"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('world_piece_behavior')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_piece_behavior_placeholder')}
            value={behavior || ''}
            onChangeText={setBehavior}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('world_piece_usability')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_piece_usability_placeholder')}
            value={usability || ''}
            onChangeText={setUsability}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('world_piece_danger')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_piece_danger_placeholder')}
            value={danger || ''}
            onChangeText={setDanger}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('world_rule_extra_notes_placeholder')}
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
          placeholder={t('select_tags_for_world_rule')}
          label={t('world_rule_tags')}
        />
      </View>

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={worldRuleNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentWorldRuleId ?? ''}
            currentEntityType="WorldRule"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="WorldRule"
            entityId={currentWorldRuleId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default WorldRuleFormScreen;
