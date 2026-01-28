import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/Select/Select';
import SuggestionTextInput from '@/src/components/common/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/TextInput/TextInput';
import { Item } from '@keres/shared/entities/Item'; // Import Item entity
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import NoteManager from '../../components/NoteManager';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ItemStackParamList } from '../../navigation/MainSystemStack'; // Use ItemStackParamList
import { createItemService } from '../../services/storymanagement/ItemService'; // Import ItemService
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/storymanagement/NoteRelationService';
import { createNoteService, NoteService } from '../../services/storymanagement/NoteService';
import { createTagRelationService } from '../../services/storymanagement/TagRelationService';
import { createTagService } from '../../services/storymanagement/TagService';
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

  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null); // Changed from choiceServiceRef
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!itemServiceRef.current) itemServiceRef.current = createItemService(drizzleDb); // Changed
      if (!noteServiceRef.current) noteServiceRef.current = createNoteService(drizzleDb);
      if (!noteRelationServiceRef.current) noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      if (!tagServiceRef.current) tagServiceRef.current = createTagService(drizzleDb);
      if (!tagRelationServiceRef.current) tagRelationServiceRef.current = createTagRelationService(drizzleDb);
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

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [itemNoteRelations, setItemNoteRelations] = useState<NoteRelation[]>([]); // Changed
  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id]);

  const fetchNoteRelationsForItem = useCallback(async () => { // Changed
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemId) return; // Changed
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, currentItemId, 'Item'); // Changed
      setItemNoteRelations(fetchedNoteRelations); // Changed
    } catch (err) {
      console.error('Failed to fetch note relations for item:', err); // Changed
    }
  }, [selectedStory?.id, currentItemId]); // Changed

  const fetchAvailableTags = useCallback(async () => {
    if (!tagServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedTags = await tagServiceRef.current.getTagsByStoryId(selectedStory.id);
      setAvailableTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  }, [selectedStory?.id]);

  const fetchItemTags = useCallback(async () => { // Changed
    if (!tagRelationServiceRef.current || !selectedStory?.id || !currentItemId) return; // Changed
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, currentItemId, 'Item'); // Changed
      setSelectedTagIds(fetchedTags.map(tag => tag.id));
    } catch (err) {
      console.error('Failed to fetch item tags:', err); // Changed
    }
  }, [selectedStory?.id, currentItemId]); // Changed

  useEffect(() => {
    const loadItemAndData = async () => { // Changed
      if (!itemServiceRef.current || !selectedStory?.id) { // Changed
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedItem = await itemServiceRef.current.getById(currentItemId!); // Changed
          if (fetchedItem) {
            setName(fetchedItem.name);
            setCategory(fetchedItem.category);
            setDescription(fetchedItem.description);
            setInitialState(fetchedItem.initialState);
            setIsFavorite(fetchedItem.isFavorite);
            setExtraNotes(fetchedItem.extraNotes);
            setCharacterOwnerId(fetchedItem.characterOwnerId);
          } else {
            setError(t('item_not_found')); // Changed
          }
        }
      } catch (err) {
        console.error('Failed to load item or related data:', err); // Changed
        setError(t('failed_to_load_item')); // Changed
      } finally {
        setLoading(false);
        fetchNotesForStory();
        fetchNoteRelationsForItem(); // Changed
        fetchAvailableTags();
        fetchItemTags(); // Changed
      }
    };
    loadItemAndData();
  }, [currentItemId, isEditing, selectedStory?.id, t, fetchNotesForStory, fetchNoteRelationsForItem, fetchAvailableTags, fetchItemTags]); // Changed dependencies

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

      if (savedItemId && tagRelationServiceRef.current) { // Changed
        await tagRelationServiceRef.current.updateTagsForEntity(userId, selectedStory.id, savedItemId, 'Item', selectedTagIds); // Changed
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

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemId || !userId) { // Changed currentChoiceId to currentItemId
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setItemNoteRelations(prev => { // Changed choiceNoteRelations to itemNoteRelations
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentItemId); // Changed currentChoiceId to currentItemId
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemId || !userId) { // Changed currentChoiceId to currentItemId
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setItemNoteRelations(prev => prev.filter(r => r.id !== relationId)); // Changed choiceNoteRelations to itemNoteRelations
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentItemId); // Changed currentChoiceId to currentItemId
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
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
                onSave={handleSaveNoteRelation}
                onDelete={handleDeleteNoteRelation}
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