import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
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
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import { useAppearsInArcs } from '@/src/hooks/useAppearsInArcs';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDrizzle } from '../../db';
import type { CharacterSelect, ItemSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  useEntityInitialLoad,
  useEntityEventSubscriptions,
} from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createCharacterService } from '../../services/storymanagement/CharacterService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { ItemsScreenNavigationProp } from './ItemListScreen';

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string };
};

type ItemDetailScreenRouteProp = RouteProp<ItemDetailScreenParamList, 'ItemDetail'>;

const ItemDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const { openItem: openJourneyMap } = useOpenPresenceMatrixViewer();
  const route = useRoute<ItemDetailScreenRouteProp>();
  const { itemId } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Item');
  const { agree, term } = useStoryVocabulary();
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const { selectedStory } = useStoryStore();

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
  const appearingArcs = useAppearsInArcs(item?.storyId ?? '', 'item', itemId);
  const [allCharacters, setAllCharacters] = useState<CharacterSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

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
        setHeaderTitle(fetchedItem.name || copy.detailsTitle);
      } else if (fetchedItem && fetchedItem.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
        setHeaderTitle(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch item details:', err);
      setError(copy.failedToLoad);
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemId, navigation, copy, t]);

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
          setHeaderTitle(updatedItem.name || copy.detailsTitle);
        }
      }
    },
    [itemId, navigation, copy],
  );

  useEntityInitialLoad(fetchItem);

  // Event subscriptions never initiate an item load.
  useEntityEventSubscriptions(
    useMemo(() => [{ event: 'item_changed', listener: handleItemChange }], [handleItemChange]),
  );

  useEffect(() => {
    if (item) {
      fetchAllCharacters();
    }
  }, [item, fetchAllCharacters]);

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'map-outline',
        label: t('presence_matrix_item_title'),
        onPress: () => openJourneyMap(itemId),
        visible: !!(selectedStory?.type === 'linear'),
      },
      {
        id: 'action-1',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ItemForm', { itemId }),
        visible: !!canEdit,
      },
    ],
  });

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!item) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const owner = item.characterOwnerId
    ? allCharacters.find((c) => c.id === item.characterOwnerId)
    : undefined;

  const commentField = createCommentFieldBindings({
    storyId: item.storyId,
    mentionSourceId: item.id,
    canComment,
    isStoryOwner,
    currentUserId,
    onDeleteComment: deleteComment,
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <DetailContainer
      title={item.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={itemTags} variant="chip" emptyMessage={t('no_tags_found')} />
      <CommentableDetailField
        {...commentField('description', item.description || t('common_na'))}
        label={t('description')}
      />
      <CommentableDetailField
        {...commentField('category', item.category || t('common_na'))}
        label={t('category')}
      />
      <CommentableDetailField
        {...commentField('initialState', item.initialState || t('common_na'))}
        label={t('initial_state')}
      />
      <DetailField
        label={t('item_character_owner_label', {
          character: term('Character'),
          ending: characterOwnerEnding,
        })}
        value={owner?.name || t('common_na')}
      />

      <CustomAttributeDetailFields storyId={item.storyId} entityType="Item" entityId={itemId} />

      <CommentableDetailField
        {...commentField('extraNotes', item.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />
      <DetailField
        label={t('is_favorite')}
        value={item.isFavorite ? t('common_yes') : t('common_no')}
      />

      <ScreenSection title={t('media_section_title')} />
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

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager storyId={item.storyId} entityType="Item" entityId={itemId} editable={false} />

      <FavoritedByList storyId={item.storyId} entityId={itemId} entityType="Item" />

      <EntityMetadata
        version={item.version}
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
        entityType="Item"
        entityId={item.id}
      />
    </DetailContainer>
  );
};

export default ItemDetailScreen;
