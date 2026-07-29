import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/Select/Select';
import SuggestionTextInput from '@/src/components/common/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/TextInput/TextInput';
import { Item } from '@keres/shared/entities/Item'; // Import Item entity
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import NoteManager from '../../components/NoteManager';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { ItemStackParamList } from '../../navigation/MainSystemStack'; // Use ItemStackParamList
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characterOwnerId
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';

type ItemFormScreenRouteProp = RouteProp<ItemStackParamList, 'ItemForm'>;
type ItemFormScreenNavigationProp = NativeStackNavigationProp<ItemStackParamList, 'ItemForm'>;

const ItemFormScreen = () => {
  useBackButtonHandler();
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentItemId; // Changed

  useFocusEffect(
    useCallback(() => {
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
          } else {
            setError(t('item_not_found'));
          }
        }
      } catch (err) {
        console.error('Failed to load item:', err);
        setError(t('failed_to_load_item'));
      } finally {
        setLoading(false);
      }
    };
    loadItem();
  }, [currentItemId, isEditing, selectedStory?.id, t]);

  const handleSave = async () => {
    if (!name.trim()) { // Changed from text.trim()
      Alert.alert(t('error'), t('item_name_required')); // Changed
      return;
    }
    if (!userId || !selectedStory?.id) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);
    setError(null);

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
        Alert.alert(t('success'), t('item_updated_successfully')); // Changed
      } else {
        const savedItem = await itemServiceRef.current!.createItem(userId, { ...itemData, storyId: selectedStory.id }); // Changed
        savedItemId = savedItem.id;
        Alert.alert(t('success'), t('item_created_successfully')); // Changed
      }

      if (savedItemId) {
        await persistTagRelations(savedItemId);
      }
      entityEventEmitter.emit('item_changed', selectedStory.id, savedItemId); // Changed

      if (!isEditing && savedItemId) { // Changed
        navigation.dispatch(StackActions.replace('ItemForm', { itemId: savedItemId })); // Changed
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save item:', err); // Changed
      setError(t('failed_to_save_item')); // Changed
      Alert.alert(t('error'), t('failed_to_save_item')); // Changed
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    Alert.alert(
      t('delete_item_title'), // Changed
      t('delete_item_message'), // Changed
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          onPress: async () => {
            if (currentItemId && itemServiceRef.current) { // Changed
              try {
                setLoading(true);
                await itemServiceRef.current.deleteItem(userId, currentItemId); // Changed
                entityEventEmitter.emit('item_changed', selectedStory?.id, currentItemId); // Changed
                Alert.alert(t('success'), t('item_deleted_successfully')); // Changed
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete item:', err); // Changed
                setError(t('failed_to_delete_item')); // Changed
                Alert.alert(t('error'), t('failed_to_delete_item')); // Changed
              } finally {
                setLoading(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const characterOptions = useMemo(() =>
    characters
      .filter(char => !char.isDeleted) // Explicitly filter out deleted characters
      .map(char => ({ label: char.name, value: char.id })), 
    [characters]
  );

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: 350, flexGrow: 1 },
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
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
          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default ItemFormScreen;