import { Ionicons } from '@expo/vector-icons';
import { Scene } from '@keres/shared';
import { ItemJourney } from '@keres/shared/entities/Item';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ItemJourneyManager from '../../components/ItemManager/ItemJourneyManager';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { CharacterSelect, ItemSelect, TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createCharacterService } from '../../services/CharacterService';
import { createItemJourneyService } from '../../services/ItemJourneyService';
import { createItemService } from '../../services/ItemService';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createSceneService } from '../../services/SceneService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ItemsScreenNavigationProp } from './ItemListScreen';

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string };
};

type ItemDetailScreenRouteProp = RouteProp<ItemDetailScreenParamList, 'ItemDetail'>;

const ItemDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!itemServiceRef.current) itemServiceRef.current = createItemService(drizzleDb);
      if (!noteServiceRef.current) noteServiceRef.current = createNoteService(drizzleDb);
      if (!noteRelationServiceRef.current) noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      if (!tagServiceRef.current) tagServiceRef.current = createTagService(drizzleDb);
      if (!tagRelationServiceRef.current) tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      if (!itemJourneyServiceRef.current) itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      if (!sceneServiceRef.current) sceneServiceRef.current = createSceneService(drizzleDb);
      if (!characterServiceRef.current) characterServiceRef.current = createCharacterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [item, setItem] = useState<ItemSelect | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [itemNoteRelations, setItemNoteRelations] = useState<NoteRelation[]>([]);
  const [itemTags, setItemTags] = useState<TagSelect[]>([]);
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]);
  const [allItems, setAllItems] = useState<ItemSelect[]>([]); // To get all items for the ItemJourneyManager
  const [allScenes, setAllScenes] = useState<Scene[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    subTitle: { fontSize: 20, fontWeight: '600', color: colors.textSecondary, marginBottom: 15 },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
    detailLabel: { fontSize: 16, fontWeight: 'bold', color: colors.textSecondary, marginTop: 5 },
  });

  const fetchItem = useCallback(async () => {
    if (!itemServiceRef.current) {
      console.warn('Item service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedItem = await itemServiceRef.current.getById(itemId);
      if (fetchedItem && !fetchedItem.isDeleted) {
        setItem(fetchedItem);
        setHeaderTitle(fetchedItem.name || t('item_details_title'));
      } else if (fetchedItem && fetchedItem.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('item_not_found'));
        setHeaderTitle(t('item_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch item details:', err);
      setError(t('failed_to_load_item'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemId, navigation, t]);

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id]);

  const fetchNoteRelationsForItem = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, itemId, 'Item');
      setItemNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for item:', err);
    }
  }, [selectedStory?.id, itemId]);

  const fetchTagsForItem = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, itemId, 'Item');
      setItemTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for item:', err);
    }
  }, [selectedStory?.id, itemId]);

  const fetchItemJourneys = useCallback(async () => {
    if (!itemJourneyServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedItemJourneys = await itemJourneyServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllItemJourneys(fetchedItemJourneys);
    } catch (err) {
      console.error('Failed to fetch item journeys:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllItems = useCallback(async () => {
    if (!itemServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedItems = await itemServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllItems(fetchedItems);
    } catch (err) {
      console.error('Failed to fetch all items:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllScenes = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedScenes = await sceneServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllScenes(fetchedScenes);
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [selectedStory?.id]);

  const fetchAllCharacters = useCallback(async () => {
    if (!characterServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedCharacters = await characterServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllCharacters(fetchedCharacters);
    } catch (err) {
      console.error('Failed to fetch all characters:', err);
    }
  }, [selectedStory?.id]);

  const handleItemChange = useCallback(async (changedStoryId: string, changedItemId: string) => {
    if (changedItemId === itemId && itemServiceRef.current) {
      const updatedItem = await itemServiceRef.current.getById(itemId);
      if (!updatedItem || updatedItem.isDeleted) {
        navigation.goBack();
      } else {
        setItem(updatedItem);
        setHeaderTitle(updatedItem.name || t('item_details_title'));
      }
    }
  }, [itemId, navigation, t]);

  const handleNoteChange = useCallback(() => {
    fetchNotesForStory();
  }, [fetchNotesForStory]);

  const handleNoteRelationChange = useCallback(() => {
    fetchNoteRelationsForItem();
  }, [fetchNoteRelationsForItem]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === itemId) fetchTagsForItem();
  }, [itemId, fetchTagsForItem]);

  useEffect(() => {
    fetchItem();
    entityEventEmitter.on('item_changed', handleItemChange);
    entityEventEmitter.on('note_changed', handleNoteChange);
    entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
    entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
    return () => {
      entityEventEmitter.off('item_changed', handleItemChange);
      entityEventEmitter.off('note_changed', handleNoteChange);
      entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
    };
  }, [itemId, fetchItem, handleItemChange, handleNoteChange, handleNoteRelationChange, handleTagRelationChange]);

  useEffect(() => {
    if (item) {
      fetchNotesForStory();
      fetchNoteRelationsForItem();
      fetchTagsForItem();
      fetchItemJourneys();
      fetchAllItems();
      fetchAllScenes();
      fetchAllCharacters();
    }
  }, [item, fetchNotesForStory, fetchNoteRelationsForItem, fetchTagsForItem, fetchItemJourneys, fetchAllItems, fetchAllScenes, fetchAllCharacters]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setItemNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, itemId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setItemNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, itemId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity onPress={() => navigation.navigate('ItemForm', { itemId })} style={{ marginRight: 15 }}>
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, itemId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.detailText}>{t('loading_item_details')}</Text></View>;
  }
  if (error) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{error}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }
  if (!item) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{t('item_data_missing')}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{item.name}</Text>
      {item.description && <Text style={styles.detailText}>{item.description}</Text>}
      {item.category && <Text style={styles.detailText}>Category: {item.category}</Text>}
      {item.initialState && <Text style={styles.detailText}>Initial State: {item.initialState}</Text>}
      {item.characterOwnerId && <Text style={styles.detailText}>Owner ID: {item.characterOwnerId}</Text>}
      {item.extraNotes && <Text style={styles.detailText}>Extra Notes: {item.extraNotes}</Text>}
      <Text style={styles.detailText}>Is Favorite: {item.isFavorite ? t('yes') : t('no')}</Text>

      <Text style={styles.sectionTitle}>{t('item_journeys_title')}</Text>
      <ItemJourneyManager
        allItemJourneys={allItemJourneys}
        allItems={allItems}
        allScenes={allScenes}
        allCharacters={allCharacters}
        currentItemId={itemId}
      />

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={itemNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemId}
        currentEntityType="Item"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={itemTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemDetailScreen;