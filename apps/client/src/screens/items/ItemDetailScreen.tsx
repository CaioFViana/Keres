import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import ItemJourneyTimeline from '@/src/components/features/item-journeys/ItemJourney/ItemJourneyTimeline';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { CharacterSelect, ItemSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { ItemsScreenNavigationProp } from './ItemListScreen';

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string };
};

type ItemDetailScreenRouteProp = RouteProp<ItemDetailScreenParamList, 'ItemDetail'>;

const ItemDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const { openItem: openJourneyMap } = useOpenPresenceMatrixViewer();
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
      if (!characterServiceRef.current)
        characterServiceRef.current = createCharacterService(drizzleDb);
    }
  }, [drizzleDb]);

  const [item, setItem] = useState<ItemSelect | null>(null);
  const { canEdit } = useStoryRole(item?.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(item?.storyId, 'Item', itemId);

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
    ...commonDetailStyleDefs(colors),
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

  const handleItemChange = useCallback(
    async (changedStoryId: string, changedItemId: string) => {
      if (changedItemId === itemId && itemServiceRef.current) {
        const updatedItem = await itemServiceRef.current.getById(itemId);
        if (!updatedItem || updatedItem.isDeleted) {
          navigation.goBack();
        } else {
          setItem(updatedItem);
          setHeaderTitle(updatedItem.name || t('item_details_title'));
        }
      }
    },
    [itemId, navigation, t],
  );

  useEntityInitialLoad(fetchItem);

  // Event subscriptions never initiate an item load.
  useEffect(() => {
    entityEventEmitter.on('item_changed', handleItemChange);
    return () => {
      entityEventEmitter.off('item_changed', handleItemChange);
    };
  }, [handleItemChange]);

  useEffect(() => {
    if (item) {
      fetchAllCharacters();
    }
  }, [item, fetchAllCharacters]);

  const renderHeaderRight = useCallback(
    () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {selectedStory?.type === 'linear' && (
          <TouchableOpacity onPress={() => openJourneyMap(itemId)} style={{ marginRight: 15 }}>
            <Ionicons name="map-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {canEdit && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ItemForm', { itemId })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="pencil-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    ),
    [navigation, itemId, colors.text, canEdit, openJourneyMap, selectedStory?.type],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight]),
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_item_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!item) {
    return (
      <ScreenError padded message={t('item_data_missing')} onGoBack={() => navigation.goBack()} />
    );
  }

  const owner = item.characterOwnerId
    ? allCharacters.find((c) => c.id === item.characterOwnerId)
    : undefined;

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      {(() => {
        const commentableFieldProps = {
          storyId: item.storyId,
          // Mentions of other entities in this one's text become links; it never links to itself.
          mentionSourceId: item.id,
          canComment,
          isStoryOwner,
          currentUserId,
          onDeleteComment: deleteComment,
          onUpdateComment: updateComment,
        };
        return (
          <>
            <TagList tags={itemTags} variant="chip" emptyMessage={t('no_tags_found')} />
            <CommentableDetailField
              {...commentableFieldProps}
              label={t('description')}
              value={item.description || t('common_na')}
              comments={commentsByField['description'] ?? []}
              onAddComment={(input) =>
                addComment(
                  { fieldKey: 'description' },
                  { ...input, contentSnapshot: item.description || t('common_na') },
                )
              }
            />
            <CommentableDetailField
              {...commentableFieldProps}
              label={t('category')}
              value={item.category || t('common_na')}
              comments={commentsByField['category'] ?? []}
              onAddComment={(input) =>
                addComment(
                  { fieldKey: 'category' },
                  { ...input, contentSnapshot: item.category || t('common_na') },
                )
              }
            />
            <CommentableDetailField
              {...commentableFieldProps}
              label={t('initial_state')}
              value={item.initialState || t('common_na')}
              comments={commentsByField['initialState'] ?? []}
              onAddComment={(input) =>
                addComment(
                  { fieldKey: 'initialState' },
                  { ...input, contentSnapshot: item.initialState || t('common_na') },
                )
              }
            />
            <DetailField label={t('character_owner')} value={owner?.name || t('common_na')} />

            <CustomAttributeDetailFields
              storyId={item.storyId}
              entityType="Item"
              entityId={itemId}
            />

            <CommentableDetailField
              {...commentableFieldProps}
              label={t('extra_notes')}
              value={item.extraNotes || t('common_na')}
              comments={commentsByField['extraNotes'] ?? []}
              onAddComment={(input) =>
                addComment(
                  { fieldKey: 'extraNotes' },
                  { ...input, contentSnapshot: item.extraNotes || t('common_na') },
                )
              }
            />
            <DetailField
              label={t('is_favorite')}
              value={item.isFavorite ? t('common_yes') : t('common_no')}
            />
          </>
        );
      })()}

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={itemId}
        ownerType="Item"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      {selectedStory && (
        <>
          <ItemJourneyTimeline
            item={item}
            storyId={selectedStory.id}
            storyType={selectedStory.type}
          />
        </>
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

      <SeeAlsoManager storyId={item.storyId} entityType="Item" entityId={itemId} editable={false} />

      <FavoritedByList storyId={item.storyId} entityId={itemId} entityType="Item" />

      <EntityMetadata
        version={item.version}
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
      />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemDetailScreen;
