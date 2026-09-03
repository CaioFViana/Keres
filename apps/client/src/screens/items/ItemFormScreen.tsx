import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
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
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import type { Item } from '@keres/shared/entities/Item'; // Import Item entity
import type { RouteProp } from '@react-navigation/native';
import { StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import type { ItemStackParamList } from '../../navigation/MainSystemStack'; // Use ItemStackParamList
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characterOwnerId
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import {
  commonFormStyleDefs,
  getCommonContainerStyles,
  getCommonInputStyles,
} from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { setDocumentTitle } from '../../utils/documentTitle';
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

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
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

  const isEditing = !!currentItemId; // Changed
  const formTitle = isEditing ? copy.editTitle : copy.createTitle;

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(formTitle);
      navigation.getParent()?.setOptions({
        title: formTitle,
        headerRight: () => <View />,
      });
    }, [navigation, formTitle]),
  );

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

  const handleSave = async () => {
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

    setLoading(true);

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
        const savedItem = await itemServiceRef.current!.updateItem(userId, currentItemId, itemData); // Changed
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
    } finally {
      setLoading(false);
    }
  };

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
      onLoadingChange: setLoading,
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
    ...commonFormStyleDefs(colors, scrollBottomPadding),
    noteSection: { marginTop: 20, marginBottom: -10 },
    tagSection: { marginTop: 20, marginBottom: 0 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={[styles.title, { color: colors.text }]}>{formTitle}</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{copy.formDescription}</Text>

      <Text style={[styles.label, { color: colors.text }]}>{copy.entity}</Text>
      <TextInput
        placeholder={copy.entity}
        value={name}
        onChangeText={setName}
        style={commonInputStyles.input}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
      <TextInput
        placeholder={t('description_placeholder')}
        value={description || ''}
        onChangeText={setDescription}
        style={commonInputStyles.multiline}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('category')}</Text>
      <SuggestionTextInput
        placeholder={t('category_placeholder')}
        value={category || ''}
        onChangeText={setCategory}
        type="item_category"
        storyId={selectedStory?.id || ''}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('initial_state')}</Text>
      <SuggestionTextInput
        placeholder={t('initial_state_placeholder')}
        value={initialState || ''}
        onChangeText={setInitialState}
        type="item_initial_state"
        storyId={selectedStory?.id || ''}
      />

      <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
      <TextInput
        placeholder={t('extra_notes_placeholder')}
        value={extraNotes || ''}
        onChangeText={setExtraNotes}
        style={commonInputStyles.multiline}
        multiline
      />

      <Text style={[styles.label, { color: colors.text }]}>
        {t('item_character_owner_label', {
          character: term('Character'),
          ending: characterOwnerEnding,
        })}
      </Text>
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

      <View style={styles.switchContainer}>
        <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>
          {t('is_favorite')}
        </Text>
        <ThemedSwitch
          value={isFavorite}
          onValueChange={setIsFavorite}
          style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      </View>

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

      <FormActions stackOnCompact style={styles.saveButton}>
        <Button onPress={handleSave}>{copy.saveLabel}</Button>
        {isEditing && (
          <Button onPress={handleDelete} style={{ backgroundColor: colors.error }}>
            {copy.deleteLabel}
          </Button>
        )}
      </FormActions>
    </KeyboardAwareScreen>
  );
};

export default ItemFormScreen;
