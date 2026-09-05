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
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import NoteManager from '@/src/components/features/notes/NoteManager';
import type { SeeAlsoManagerHandle } from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { Item } from '@keres/shared/entities/Item'; // Import Item entity
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { ItemStackParamList } from '../../navigation/MainSystemStack'; // Use ItemStackParamList
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characterOwnerId
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

type ItemFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemForm'>;
type ItemFormScreenNavigationProp = NativeStackNavigationProp<ItemStackParamList, 'ItemForm'>;

const ItemFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemFormScreenNavigationProp>();
  const route = useRoute<ItemFormScreenRouteProp>();
  const { itemId: initialItemId } = route.params || {}; // Changed from choiceId
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
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();

  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);
  const seeAlsoManagerRef = useRef<SeeAlsoManagerHandle>(null);

  useEffect(() => {
    if (drizzleDb && !itemServiceRef.current) {
      itemServiceRef.current = createItemService(drizzleDb);
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const [currentItemId, setCurrentItemId] = useState<string | undefined>(initialItemId); // Changed
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [characterOwnerId, setCharacterOwnerId] = useState<string | null>(null);

  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    allNotes,
    noteRelations: itemNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
  } = useEntityRelations({ entityType: 'Item', entityId: currentItemId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Item');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!currentItemId; // Changed
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useScreenHeader({
    target: 'parent',
    title: formTitle,
  });

  useEffect(() => {
    const loadItem = async () => {
      if (!itemServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedItem = await itemServiceRef.current.getById(currentItemId!);
          if (fetchedItem) {
            setName(fetchedItem.name);
            setCategory(fetchedItem.category);
            setDescription(fetchedItem.description);
            setInitialState(fetchedItem.initialState);
            setIsFavorite(fetchedItem.isFavorite);
            setExtraNotes(fetchedItem.extraNotes);
            setCharacterOwnerId(fetchedItem.characterOwnerId);

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              currentItemId!,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
          } else {
            console.warn('Item not found:', currentItemId);
          }
        }
      } catch (err) {
        console.error('Failed to load item:', err);
      } finally {
        setLoading(false);
      }
    };
    loadItem();
  }, [currentItemId, drizzleDb, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = () =>
    runSave(async () => {
      if (!name.trim()) {
        // Changed from text.trim()
        AppAlert.alert(t('error'), copy.required);
        return;
      }
      const missingRequiredField = validateRequiredCustomAttributes(customFields, customValues);
      if (missingRequiredField) {
        AppAlert.alert(t('error'), t('custom_attribute_required', { field: missingRequiredField }));
        return;
      }
      if (!userId || !selectedStory?.id) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }

      try {
        const itemData: Omit<
          Item,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          // Changed
          name: name.trim(),
          category: category,
          description: description,
          initialState: initialState,
          isFavorite: isFavorite,
          extraNotes: extraNotes,
          characterOwnerId: characterOwnerId,
        };

        let savedItemId: string | undefined = currentItemId; // Changed

        if (isEditing && currentItemId) {
          // Changed
          const savedItem = await itemServiceRef.current!.updateItem(
            userId,
            currentItemId,
            itemData,
          ); // Changed
          savedItemId = savedItem.id;
          AppAlert.alert(t('success'), copy.updated);
        } else {
          const savedItem = await itemServiceRef.current!.createItem(userId, {
            ...itemData,
            storyId: selectedStory.id,
          }); // Changed
          savedItemId = savedItem.id;
          setCurrentItemId(savedItem.id);
          AppAlert.alert(t('success'), copy.created);
        }

        if (savedItemId) {
          await persistTagRelations(savedItemId);
          await persistNoteRelations(savedItemId);
          await seeAlsoManagerRef.current?.persistPending(savedItemId);
          await createAttributeValueService(drizzleDb).saveValuesForEntity(
            userId,
            selectedStory.id,
            'Item',
            savedItemId,
            customValues,
          );
        }
        entityEventEmitter.emit('item_changed', selectedStory.id, savedItemId); // Changed

        if (!isEditing && savedItemId) {
          // Changed
          navigation.dispatch(StackActions.replace('ItemForm', { itemId: savedItemId })); // Changed
        } else {
          navigation.goBack();
        }
      } catch (err) {
        console.error('Failed to save item:', err); // Changed
        AppAlert.alert(t('error'), copy.failedToSave);
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!currentItemId || !itemServiceRef.current) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_item_title',
      title: copy.deleteLabel,
      messageKey: 'delete_item_message',
      message: copy.deleteMessage,
      successMessage: copy.deleted,
      failureKey: 'failed_to_delete_item',
      failureMessage: copy.failedToDelete,
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await itemServiceRef.current!.deleteItem(userId, currentItemId);
        entityEventEmitter.emit('item_changed', selectedStory?.id, currentItemId);
        navigation.goBack();
      },
    });
  };

  const characterOptions = useMemo(
    () =>
      characters
        .filter((char) => !char.isDeleted) // Explicitly filter out deleted characters
        .map((char) => ({ label: char.name, value: char.id })),
    [characters],
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
            onSelectionChange={setSelectedTagIds}
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
