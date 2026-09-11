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
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../hooks/useEntityFormSecondaryDraft';
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
      <FormField label={copy.entity}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={copy.entity}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('description_placeholder')}
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
            placeholder={t('select_tags_for_item')}
            label={t('item_tags')}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <NoteManager
            noteRelations={itemNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentItemId ?? ''}
            currentEntityType="Item"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="Item"
            entityId={currentItemId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ItemFormScreen;
