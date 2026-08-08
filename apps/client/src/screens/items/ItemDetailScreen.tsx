import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TagChipList from '@/src/components/common/display/TagChipList/TagChipList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import ItemJourneyTimeline from '@/src/components/features/item-journeys/ItemJourney/ItemJourneyTimeline';
import NoteManager from '@/src/components/features/notes/NoteManager';
import { useDrizzle } from '../../db';
import { CharacterSelect, ItemSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ItemsScreenNavigationProp } from './ItemListScreen';

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string };
};

type ItemDetailScreenRouteProp = RouteProp<ItemDetailScreenParamList, 'ItemDetail'>;

const ItemDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!itemServiceRef.current) itemServiceRef.current = createItemService(drizzleDb);
      if (!characterServiceRef.current) characterServiceRef.current = createCharacterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [item, setItem] = useState<ItemSelect | null>(null);
  const { canEdit } = useStoryRole(item?.storyId);

  const {
    selectedTags: itemTags,
    allNotes,
    noteRelations: itemNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Item', entityId: itemId });
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
      fetchAllCharacters();
    }
  }, [item, fetchAllCharacters]);

  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity onPress={() => navigation.navigate('ItemForm', { itemId })} style={{ marginRight: 15 }}>
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, itemId, colors.text, canEdit]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
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
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <TagChipList tags={itemTags} />
      <DetailField label={t('description')} value={item.description || t('common_na')} />
      <DetailField label={t('category')} value={item.category || t('common_na')} />
      <DetailField label={t('initial_state')} value={item.initialState || t('common_na')} />
      <DetailField label={t('character_owner')} value={owner?.name || t('common_na')} />

      <CustomAttributeDetailFields storyId={item.storyId} entityType="Item" entityId={itemId} />

      <DetailField label={t('extra_notes')} value={item.extraNotes || t('common_na')} />
      <DetailField label={t('is_favorite')} value={item.isFavorite ? t('common_yes') : t('common_no')} />

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={itemId}
        ownerType="Item"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      {selectedStory && (
        <ItemJourneyTimeline item={item} storyId={selectedStory.id} storyType={selectedStory.type} />
      )}

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

      <EntityMetadata version={item.version} createdAt={item.createdAt} updatedAt={item.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemDetailScreen;
