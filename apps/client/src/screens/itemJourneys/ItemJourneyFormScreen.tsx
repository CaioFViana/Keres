import { ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
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
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityFormSecondaryDraft } from '../../hooks/useEntityFormSecondaryDraft';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import { useItemJourneyFormActions } from './useItemJourneyFormActions';
import { useItemJourneyFormAssociations } from './useItemJourneyFormAssociations';
import { useItemJourneyFormResources } from './useItemJourneyFormResources';
import { useItemJourneyFormState } from './useItemJourneyFormState';

type ItemJourneyFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemJourneyForm'>;
type ItemJourneyFormScreenNavigationProp = NativeStackNavigationProp<
  ItemStackParamList,
  'ItemJourneyForm'
>;

const styles = StyleSheet.create({
  noteSection: { marginTop: 20, marginBottom: 10 },
  tagSection: { marginTop: 20, marginBottom: 10 },
});

const ItemJourneyFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneyFormScreenNavigationProp>();
  const route = useRoute<ItemJourneyFormScreenRouteProp>();
  const { itemJourneyId: initialItemJourneyId, itemId: prefilledItemId } = route.params || {};
  const { t } = useTranslation();
  const itemCopy = useVocabularyEntityCopy('Item');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { agree, term } = useStoryVocabulary();
  const characterTerm = term('Character');
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const characterOwnerPrefix = agree('Character', {
    masculine: 'Novo',
    feminine: 'Nova',
    neutral: 'Novo(a)',
  });
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const commonInputStyles = getCommonInputStyles(colors);

  const { itemJourneyServiceRef, items, scenes, characters } = useItemJourneyFormResources(
    selectedStory?.id,
  );

  const itemJourneyFormState = useItemJourneyFormState({
    initialItemJourneyId,
    prefilledItemId,
    storyId: selectedStory?.id,
    itemJourneyServiceRef,
  });
  const {
    currentItemJourneyId,
    itemId,
    setItemId,
    sceneId,
    setSceneId,
    newCharacterOwnerId,
    setNewCharacterOwnerId,
    newState,
    setNewState,
    extraNotes,
    setExtraNotes,
    loading,
    isEditing,
  } = itemJourneyFormState;

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    itemJourneyNoteRelations,
    pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useItemJourneyFormAssociations(currentItemJourneyId);

  const getCustomValues = useCallback(() => ({}), []);
  const { persistSecondaryDraft, clearSecondaryDraft } = useEntityFormSecondaryDraft({
    storyId: selectedStory?.id,
    entityType: 'ItemJourney',
    selectedTagIds,
    pendingNoteRelations,
    getCustomValues,
  });

  const { deleting, handleDelete, handleSave, saving, seeAlsoManagerRef } =
    useItemJourneyFormActions({
      state: itemJourneyFormState,
      itemJourneyServiceRef,
      navigation,
      storyId: selectedStory?.id,
      userId,
      persistTagRelations,
      persistNoteRelations,
      persistSecondaryDraft,
      clearSecondaryDraft,
    });

  const journey = itemCopy.itemJourney;
  const formTitle = t(isEditing ? 'vocabulary_edit_entity' : 'vocabulary_create_entity', {
    entity: journey,
  });

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  const itemOptions = useMemo(
    () =>
      items.filter((item) => !item.isDeleted).map((item) => ({ label: item.name, value: item.id })),
    [items],
  );

  const sceneOptions = useMemo(
    () =>
      scenes
        .filter((scene) => !scene.isDeleted)
        .map((scene) => ({ label: scene.name, value: scene.id })),
    [scenes],
  );

  const characterOptions = useMemo(
    () =>
      characters
        .filter((char) => !char.isDeleted)
        .map((char) => ({ label: char.name, value: char.id })),
    [characters],
  );

  if (loading) {
    return <ScreenLoading />;
  }

  return (
    <EntityFormContainer
      title={formTitle}
      description={t('item_journey_form_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {t('vocabulary_save_entity', { entity: journey })}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {t('vocabulary_delete_entity', { entity: journey })}
            </Button>
          )}
        </>
      }
    >
      <FormField label={itemCopy.entity}>
        <SingleSelectPill
          options={itemOptions}
          value={itemId}
          onValueChange={setItemId}
          placeholder={itemCopy.select}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField label={sceneCopy.entity}>
        <SingleSelectPill
          options={sceneOptions}
          value={sceneId}
          onValueChange={setSceneId}
          placeholder={sceneCopy.select}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField
        label={t('item_journey_new_character_owner_label', {
          character: characterTerm,
          ending: characterOwnerEnding,
          prefix: characterOwnerPrefix,
        })}
      >
        <SingleSelectPill
          options={characterOptions}
          value={newCharacterOwnerId}
          onValueChange={setNewCharacterOwnerId}
          placeholder={t('select_item_journey_new_character_owner', {
            character: characterTerm,
            ending: characterOwnerEnding,
            prefix: characterOwnerPrefix,
          })}
          multiple={false}
          allowDeselect={true}
        />
      </FormField>

      <FormField label={t('new_state')}>
        <SuggestionTextInput
          placeholder={t('new_state_placeholder')}
          value={newState || ''}
          onChangeText={setNewState}
          type="item_state"
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

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <ScreenSection title={t('tags_title')} />
          <MultiSelectPill
            options={availableTags.map((tag) => ({
              label: tag.name,
              value: tag.id,
              color: tag.color || colors.primaryContainer,
            }))}
            selectedValues={selectedTagIds}
            onSelectionChange={setSelectedTagIds}
            placeholder={t('select_tags_for_item_journey')}
            label={t('item_journey_tags')}
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.noteSection}>
          <ScreenSection title={t('notes_title')} />
          <NoteManager
            noteRelations={itemJourneyNoteRelations}
            availableNotes={allNotes}
            onSave={saveNoteRelation}
            onDelete={deleteNoteRelation}
            editable={true}
            currentStoryId={selectedStory.id}
            currentEntityId={currentItemJourneyId ?? ''}
            currentEntityType="ItemJourney"
          />
        </View>
      )}

      {selectedStory?.id && (
        <View style={styles.tagSection}>
          <SeeAlsoManager
            ref={seeAlsoManagerRef}
            storyId={selectedStory.id}
            entityType="ItemJourney"
            entityId={currentItemJourneyId ?? ''}
            editable={true}
          />
        </View>
      )}
    </EntityFormContainer>
  );
};

export default ItemJourneyFormScreen;
