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
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../hooks/useEntityFormSecondaryDraft';
import { useEntityFormHeader } from '@/src/hooks/useEntityFormHeader';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import { useItemFormActions } from './useItemFormActions';
import { useItemFormAssociations } from './useItemFormAssociations';
import { useItemFormResources } from './useItemFormResources';
import { useItemFormState } from './useItemFormState';

type ItemFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemForm'>;
type ItemFormScreenNavigationProp = NativeStackNavigationProp<ItemStackParamList, 'ItemForm'>;

const styles = StyleSheet.create({
  noteSection: { marginTop: 20, marginBottom: -10 },
  tagSection: { marginTop: 20, marginBottom: 0 },
});

const ItemFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemFormScreenNavigationProp>();
  const route = useRoute<ItemFormScreenRouteProp>();
  const { itemId: initialItemId } = route.params || {};
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Item');
  const { agree, term } = useStoryVocabulary();
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const commonInputStyles = getCommonInputStyles(colors);
  const customFields = useStorySchemaFields(selectedStory?.id, 'Item');

  const { drizzleDb, itemServiceRef } = useItemFormResources();

  const itemFormState = useItemFormState({
    initialItemId,
    storyId: selectedStory?.id,
    drizzleDb,
    itemServiceRef,
    customFields,
  });
  const {
    currentItemId,
    name,
    setName,
    category,
    setCategory,
    description,
    setDescription,
    initialState,
    setInitialState,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    characterOwnerId,
    setCharacterOwnerId,
    customValues,
    setCustomValues,
    loading,
    isEditing,
    isDirty,
    resetForm,
  } = itemFormState;

  const {
    availableTags,
    selectedTagIds,
    allNotes,
    itemNoteRelations,
    pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    handleTagSelectionChange,
    characterOptions,
  } = useItemFormAssociations({
    currentItemId,
    storyId: selectedStory?.id,
    drizzleDb,
  });

  const getCustomValues = useCallback(
    () => itemFormState.customValues,
    [itemFormState.customValues],
  );
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'Item',
    selectedTagIds,
    pendingNoteRelations,
    getCustomValues,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } = useItemFormActions({
    state: itemFormState,
    customFields,
    drizzleDb,
    itemServiceRef,
    navigation,
    storyId: selectedStory?.id,
    userId,
    persistTagRelations,
    persistNoteRelations,
    persistSecondaryDraft,
    clearSecondaryDraft,
  });

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
          deleteLabel={copy.deleteLabel}
          saveLabel={copy.saveLabel}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      }
    >
      <FormTextField
        label={copy.entity}
        placeholder={copy.entity}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <FormTextAreaField
        label={t('description')}
        placeholder={t('description_placeholder')}
        value={description}
        onChangeText={setDescription}
        style={commonInputStyles.multiline}
      />

      <FormField label={t('category')}>
        <SuggestionTextInput
          placeholder={t('category_placeholder')}
          value={category || ''}
          onChangeText={setCategory}
          type="item_category"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormField label={t('initial_state')}>
        <SuggestionTextInput
          placeholder={t('initial_state_placeholder')}
          value={initialState || ''}
          onChangeText={setInitialState}
          type="item_initial_state"
          storyId={selectedStory?.id || ''}
        />
      </FormField>

      <FormTextAreaField
        label={t('extra_notes')}
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes}
        onChangeText={setExtraNotes}
        style={commonInputStyles.multiline}
      />

      <FormField
        label={t('item_character_owner_label', {
          character: term('Character'),
          ending: characterOwnerEnding,
        })}
      >
        <SingleSelectPill
          options={characterOptions}
          value={characterOwnerId}
          onValueChange={setCharacterOwnerId}
          placeholder={t('select_item_character_owner', {
            character: term('Character'),
            ending: characterOwnerEnding,
          })}
          multiple={false}
        />
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

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
            placeholder={t('select_tags_for_item')}
            label={t('item_tags')}
            defaultColor={colors.primaryContainer}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <EntityNotesManager
            noteRelations={itemNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            target={{
              storyId: selectedStory.id,
              entityType: 'Item',
              entityId: currentItemId ?? '',
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
              entityType: 'Item',
              entityId: currentItemId ?? '',
            }}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ItemFormScreen;
