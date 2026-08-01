import { Ionicons } from '@expo/vector-icons';
import { Scene } from '@keres/shared';
import { ItemJourney } from '@keres/shared/entities/Item';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DetailField from '../../components/common/DetailField/DetailField';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import EntityGalleryManager from '../../components/GalleryManager/EntityGalleryManager';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import ItemJourneyManager from '../../components/ItemManager/ItemJourneyManager';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { CharacterSelect, ItemSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
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
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!itemServiceRef.current) itemServiceRef.current = createItemService(drizzleDb);
      if (!itemJourneyServiceRef.current) itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      if (!sceneServiceRef.current) sceneServiceRef.current = createSceneService(drizzleDb);
      if (!characterServiceRef.current) characterServiceRef.current = createCharacterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [item, setItem] = useState<ItemSelect | null>(null);

  const {
    selectedTags: itemTags,
    allNotes,
    noteRelations: itemNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Item', entityId: itemId });
  const [allItemJourneys, setAllItemJourneys] = useState<ItemJourney[]>([]);
  const [allItems, setAllItems] = useState<ItemSelect[]>([]); // To get all items for the ItemJourneyManager
  const [allScenes, setAllScenes] = useState<Scene[]>([]);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
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

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchItem();
    entityEventEmitter.on('item_changed', handleItemChange);
    return () => {
      entityEventEmitter.off('item_changed', handleItemChange);
    };
  }, [itemId, fetchItem, handleItemChange]);

  useEffect(() => {
    if (item) {
      fetchItemJourneys();
      fetchAllItems();
      fetchAllScenes();
      fetchAllCharacters();
    }
  }, [item, fetchItemJourneys, fetchAllItems, fetchAllScenes, fetchAllCharacters]);

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
    return <ScreenLoading padded message={t('loading_item_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!item) {
    return <ScreenError padded message={t('item_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  const owner = item.characterOwnerId ? allCharacters.find(c => c.id === item.characterOwnerId) : undefined;

  return (
    <ScrollView style={commonContainerStyles.container}>
      <Text style={styles.mainTitle}>{item.name}</Text>
      <DetailField label={t('description')} value={item.description || t('common_na')} />
      <DetailField label={t('category')} value={item.category || t('common_na')} />
      <DetailField label={t('initial_state')} value={item.initialState || t('common_na')} />
      <DetailField label={t('character_owner')} value={owner?.name || t('common_na')} />
      <DetailField label={t('extra_notes')} value={item.extraNotes || t('common_na')} />
      <DetailField label={t('is_favorite')} value={item.isFavorite ? t('common_yes') : t('common_no')} />

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={itemId}
        ownerType="Item"
        onPressMedia={openGalleryMediaViewer}
      />

      <ItemJourneyManager
        allItemJourneys={allItemJourneys}
        allItems={allItems}
        allScenes={allScenes}
        allCharacters={allCharacters}
        currentItemId={itemId}
      />

      <NoteManager
        noteRelations={itemNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
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