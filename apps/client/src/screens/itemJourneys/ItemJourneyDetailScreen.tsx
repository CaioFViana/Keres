import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';

import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import TagList from '@/src/components/common/display/TagList/TagList';
import { useDrizzle } from '../../db';
import type { ItemJourneySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import {
  useEntityInitialLoad,
  useEntityEventSubscriptions,
} from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useCharacterStore } from '../../state/characterStore';
import { useItemStore } from '../../state/itemStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { ItemStackParamList } from '../../navigation/MainSystemStack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type ItemJourneyDetailScreenParamList = {
  ItemJourneyDetail: { itemJourneyId: string };
};

type ItemJourneyDetailScreenRouteProp = RouteProp<
  ItemJourneyDetailScreenParamList,
  'ItemJourneyDetail'
>;

const ItemJourneyDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ItemStackParamList, 'ItemJourneyDetail'>>();
  const route = useRoute<ItemJourneyDetailScreenRouteProp>();
  const { itemJourneyId } = route.params;
  const { t } = useTranslation();
  const itemCopy = useVocabularyEntityCopy('Item');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { agree, term } = useStoryVocabulary();
  const characterTerm = term('Character');
  const characterOwnerEnding = agree('Character', {
    masculine: 'o',
    feminine: 'a',
    neutral: 'o',
  });
  const characterOwnerPrefix = agree('Character', {
    masculine: 'Novo',
    feminine: 'Nova',
    neutral: 'Novo(a)',
  });
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);

  const {
    items,
    fetchItems,
    setDbAndStoryId: setItemDbAndStoryId,
    initializeService: initializeItemService,
  } = useItemStore();
  const {
    scenes,
    fetchScenes,
    setDbAndStoryId: setSceneDbAndStoryId,
    initializeService: initializeSceneService,
  } = useSceneStore();
  const {
    characters,
    fetchCharacters,
    setDbAndStoryId: setCharacterDbAndStoryId,
    initializeService: initializeCharacterService,
  } = useCharacterStore();

  useEffect(() => {
    if (drizzleDb && !itemJourneyServiceRef.current) {
      itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();

      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();

      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [
    drizzleDb,
    selectedStory?.id,
    setItemDbAndStoryId,
    initializeItemService,
    fetchItems,
    setSceneDbAndStoryId,
    initializeSceneService,
    fetchScenes,
    setCharacterDbAndStoryId,
    initializeCharacterService,
    fetchCharacters,
  ]);

  const [itemJourney, setItemJourney] = useState<ItemJourneySelect | null>(null);
  const { canEdit } = useStoryRole(itemJourney?.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(itemJourney?.storyId, 'ItemJourney', itemJourneyId);

  const {
    selectedTags: itemJourneyTags,
    allNotes,
    noteRelations: itemJourneyNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'ItemJourney', entityId: itemJourneyId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const styles = StyleSheet.create({
    relationLink: { flexDirection: 'row', alignItems: 'center' },
  });

  const fetchItemJourney = useCallback(async () => {
    if (!itemJourneyServiceRef.current) {
      console.warn('Item Journey service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
      if (fetchedItemJourney && !fetchedItemJourney.isDeleted) {
        setItemJourney(fetchedItemJourney);
        // Display item name + new state as title
        const relatedItem = items.find((item) => item.id === fetchedItemJourney.itemId);
        setHeaderTitle(`${relatedItem?.name || itemCopy.unknown} - ${fetchedItemJourney.newState}`);
      } else if (fetchedItemJourney && fetchedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('vocabulary_entity_not_found', { entity: itemCopy.itemJourney, ending: 'a' }));
        setHeaderTitle(
          t('vocabulary_entity_not_found', { entity: itemCopy.itemJourney, ending: 'a' }),
        );
      }
    } catch (err) {
      console.error('Failed to fetch item journey details:', err);
      setError(t('vocabulary_failed_to_load_entity', { entity: itemCopy.itemJourney }));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemJourneyId, navigation, t, items, itemCopy]);

  const handleItemJourneyChange = useCallback(
    async (changedStoryId: string, changedItemJourneyId: string) => {
      if (changedItemJourneyId === itemJourneyId && itemJourneyServiceRef.current) {
        const updatedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
        if (!updatedItemJourney || updatedItemJourney.isDeleted) {
          navigation.goBack();
        } else {
          setItemJourney(updatedItemJourney);
          const relatedItem = items.find((item) => item.id === updatedItemJourney.itemId);
          setHeaderTitle(
            `${relatedItem?.name || itemCopy.unknown} - ${updatedItemJourney.newState}`,
          );
        }
      }
    },
    [itemJourneyId, navigation, items, itemCopy],
  );

  useEntityInitialLoad(fetchItemJourney);

  // Event subscriptions never initiate an item-journey load.
  useEntityEventSubscriptions(
    useMemo(
      () => [{ event: 'item_journey_changed', listener: handleItemJourneyChange }],
      [handleItemJourneyChange],
    ),
  );

  const relatedItem = items.find((item) => item.id === itemJourney?.itemId);
  const relatedScene = scenes.find((scene) => scene.id === itemJourney?.sceneId);
  const newCharacterOwner = characters.find((char) => char.id === itemJourney?.newCharacterOwnerId);

  const navigateToDetail = useNavigateToEntityDetail();

  const handleItemPress = useCallback(() => {
    if (!relatedItem) return;
    navigateToDetail('Item', relatedItem.id);
  }, [navigateToDetail, relatedItem]);

  const handleScenePress = useCallback(() => {
    if (!relatedScene) return;
    navigateToDetail('Scene', relatedScene.id);
  }, [navigateToDetail, relatedScene]);

  const handleNewOwnerPress = useCallback(() => {
    if (!newCharacterOwner) return;
    navigateToDetail('Character', newCharacterOwner.id);
  }, [navigateToDetail, newCharacterOwner]);

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('ItemJourneyForm', { itemJourneyId }),
        visible: !!canEdit,
      },
    ],
  });

  if (loading) {
    return (
      <ScreenLoading
        padded
        message={t('vocabulary_loading_entity_details', { entity: itemCopy.itemJourney })}
      />
    );
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!itemJourney) {
    return (
      <ScreenError
        padded
        message={t('vocabulary_entity_data_missing', { entity: itemCopy.itemJourney })}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const commentField = createCommentFieldBindings({
    storyId: itemJourney.storyId,
    canComment: canComment,
    isStoryOwner: isStoryOwner,
    currentUserId: currentUserId,
    onDeleteComment: deleteComment,
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <DetailContainer
      title={headerTitle}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={itemJourneyTags} variant="chip" emptyMessage={t('no_tags_found')} />

      {relatedItem && (
        <TouchableOpacity onPress={handleItemPress} style={styles.relationLink} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <DetailField label={itemCopy.entity} value={relatedItem.name} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      <CommentableDetailField
        {...commentField('newState', itemJourney.newState || t('common_na'))}
        label={t('item_state')}
      />
      <CommentableDetailField
        {...commentField('extraNotes', itemJourney.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />
      {relatedScene && (
        <TouchableOpacity
          onPress={handleScenePress}
          style={styles.relationLink}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <DetailField label={sceneCopy.entity} value={relatedScene.name} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      {newCharacterOwner && (
        <TouchableOpacity
          onPress={handleNewOwnerPress}
          style={styles.relationLink}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <DetailField
              label={t('item_journey_new_character_owner_label', {
                character: characterTerm,
                ending: characterOwnerEnding,
                prefix: characterOwnerPrefix,
              })}
              value={newCharacterOwner.name}
            />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      <NoteManager
        noteRelations={itemJourneyNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemJourneyId}
        currentEntityType="ItemJourney"
      />

      <SeeAlsoManager
        storyId={itemJourney.storyId}
        entityType="ItemJourney"
        entityId={itemJourneyId}
        editable={false}
      />

      <EntityMetadata
        version={itemJourney.version}
        createdAt={itemJourney.createdAt}
        updatedAt={itemJourney.updatedAt}
      />
    </DetailContainer>
  );
};

export default ItemJourneyDetailScreen;
