import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/inputs/Select/Select';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { Item } from '@keres/shared/entities/Item'; // Import Item entity
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import CustomAttributeFields, { CustomAttributeValues, getDefaultCustomAttributeValues, validateRequiredCustomAttributes } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import NoteManager from '@/src/components/features/notes/NoteManager';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStorySchemaFields } from '../../hooks/useStorySchemaFields';
import { ItemStackParamList } from '../../navigation/MainSystemStack'; // Use ItemStackParamList
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characterOwnerId
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { AppAlert } from '../../utils/AppAlert';

type ItemFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemForm'>;
type ItemFormScreenNavigationProp = NativeStackNavigationProp<ItemStackParamList, 'ItemForm'>;

const ItemFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemFormScreenNavigationProp>();
  const route = useRoute<ItemFormScreenRouteProp>();
  const { itemId: initialItemId } = route.params || {}; // Changed from choiceId
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const { characters, fetchCharacters, setDbAndStoryId: setCharacterDbAndStoryId, initializeService: initializeCharacterService } = useCharacterStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const confirmDelete = useConfirmDelete();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);

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
  }, [drizzleDb, selectedStory?.id, setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters]);

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
  } = useEntityRelations({ entityType: 'Item', entityId: currentItemId });

  const customFields = useStorySchemaFields(selectedStory?.id, 'Item');
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const customDefaultsAppliedRef = useRef(false);

  const [loading, setLoading] = useState(true);

  const isEditing = !!currentItemId; // Changed

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(isEditing ? t('edit_item_title') : t('create_item_title'));
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_item_title') : t('create_item_title'), // Changed
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t])
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

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(currentItemId!);
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
  }, [currentItemId, isEditing, selectedStory?.id, t]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const handleSave = async () => {
    if (!name.trim()) { // Changed from text.trim()
      AppAlert.alert(t('error'), t('item_name_required')); // Changed
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
      const itemData: Omit<Item, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = { // Changed
        name: name.trim(),
        category: category,
        description: description,
        initialState: initialState,
        isFavorite: isFavorite,
        extraNotes: extraNotes,
        characterOwnerId: characterOwnerId,
      };

      let savedItemId: string | undefined = currentItemId; // Changed

      if (isEditing && currentItemId) { // Changed
        const savedItem = await itemServiceRef.current!.updateItem(userId, currentItemId, itemData); // Changed
        savedItemId = savedItem.id;
        AppAlert.alert(t('success'), t('item_updated_successfully')); // Changed
      } else {
        const savedItem = await itemServiceRef.current!.createItem(userId, { ...itemData, storyId: selectedStory.id }); // Changed
        savedItemId = savedItem.id;
        setCurrentItemId(savedItem.id);
        AppAlert.alert(t('success'), t('item_created_successfully')); // Changed
      }

      if (savedItemId) {
        await persistTagRelations(savedItemId);
        await createAttributeValueService(drizzleDb).saveValuesForEntity(userId, selectedStory.id, 'Item', savedItemId, customValues);
      }
      entityEventEmitter.emit('item_changed', selectedStory.id, savedItemId); // Changed

      if (!isEditing && savedItemId) { // Changed
        navigation.dispatch(StackActions.replace('ItemForm', { itemId: savedItemId })); // Changed
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save item:', err); // Changed
      AppAlert.alert(t('error'), t('failed_to_save_item')); // Changed
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
      messageKey: 'delete_item_message',
      successKey: 'item_deleted_successfully',
      failureKey: 'failed_to_delete_item',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await itemServiceRef.current!.deleteItem(userId, currentItemId);
        entityEventEmitter.emit('item_changed', selectedStory?.id, currentItemId);
        navigation.goBack();
      },
    });
  };

  const characterOptions = useMemo(() =>
    characters
      .filter(char => !char.isDeleted) // Explicitly filter out deleted characters
      .map(char => ({ label: char.name, value: char.id })), 
    [characters]
  );

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 5 },
    saveButton: { marginTop: 20, marginBottom: 0 },
    deleteButton: { backgroundColor: 'red', marginBottom: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noteSection: { marginTop: 20, marginBottom: 10 },
    tagSection: { marginTop: 20, marginBottom: 10 },
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
      <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_item_title') : t('create_item_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{t('item_form_description')}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('item_name')}</Text>
          <TextInput
            placeholder={t('item_name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('description')}</Text>
          <TextInput
            placeholder={t('description_placeholder')}
            value={description || ''}
            onChangeText={setDescription}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('category')}</Text>
          <SuggestionTextInput
            placeholder={t('category_placeholder')}
            value={category || ''}
            onChangeText={setCategory}
            type="item_category"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('initial_state')}</Text>
          <SuggestionTextInput
            placeholder={t('initial_state_placeholder')}
            value={initialState || ''}
            onChangeText={setInitialState}
            type="item_initial_state"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('character_owner')}</Text>
          <Select
            options={characterOptions}
            value={characterOwnerId}
            onValueChange={setCharacterOwnerId}
            placeholder={t('select_character_owner')}
            multiple={false}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <CustomAttributeFields
            storyId={selectedStory?.id || ''}
            fields={customFields}
            values={customValues}
            onChange={(fieldId, value) => setCustomValues((prev) => ({ ...prev, [fieldId]: value }))}
          />

          {currentItemId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
              <MultiSelectPill
                options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
                selectedValues={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder={t('select_tags_for_item')}
                label={t('item_tags')}
              />
            </View>
          )}

          {currentItemId && selectedStory?.id && (
            <View style={styles.noteSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={itemNoteRelations}
                availableNotes={allNotes}
                onSave={saveNoteRelation}
                onDelete={deleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentItemId}
                currentEntityType="Item"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>{t('save_item')}</Button>
          {isEditing && (<Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>{t('delete_item_title')}</Button>)}
      </KeyboardAwareScreen>
  );
};

export default ItemFormScreen;
