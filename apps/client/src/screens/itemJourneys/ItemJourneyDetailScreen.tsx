import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import TagChipList from '@/src/components/common/display/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ItemJourneySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStoryRole } from '../../hooks/useStoryRole';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useCharacterStore } from '../../state/characterStore';
import { useItemStore } from '../../state/itemStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import { ItemJourneysScreenNavigationProp } from './ItemJourneyListScreen';

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
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();
  const route = useRoute<ItemJourneyDetailScreenRouteProp>();
  const { itemJourneyId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

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

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    subTitle: { fontSize: 20, fontWeight: '600', color: colors.textSecondary, marginBottom: 15 },
    buttonContainer: { marginTop: 20 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 15,
      marginBottom: 5,
    },
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
        setHeaderTitle(
          `${relatedItem?.name || t('unknown_item')} - ${fetchedItemJourney.newState}`,
        );
      } else if (fetchedItemJourney && fetchedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('item_journey_not_found'));
        setHeaderTitle(t('item_journey_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch item journey details:', err);
      setError(t('failed_to_load_item_journey'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemJourneyId, navigation, t, items]);

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
            `${relatedItem?.name || t('unknown_item')} - ${updatedItemJourney.newState}`,
          );
        }
      }
    },
    [itemJourneyId, navigation, t, items],
  );

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchItemJourney();
    entityEventEmitter.on('item_journey_changed', handleItemJourneyChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
    };
  }, [itemJourneyId, fetchItemJourney, handleItemJourneyChange]);

  const relatedItem = items.find((item) => item.id === itemJourney?.itemId);
  const relatedScene = scenes.find((scene) => scene.id === itemJourney?.sceneId);
  const newCharacterOwner = characters.find((char) => char.id === itemJourney?.newCharacterOwnerId);

  const handleItemPress = useCallback(() => {
    if (!relatedItem) return;
    const drawerNavigation =
      navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Item', relatedItem.id);
    }
  }, [navigation, relatedItem]);

  const handleScenePress = useCallback(() => {
    if (!relatedScene) return;
    const drawerNavigation =
      navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Scene', relatedScene.id);
    }
  }, [navigation, relatedScene]);

  const handleNewOwnerPress = useCallback(() => {
    if (!newCharacterOwner) return;
    const drawerNavigation =
      navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Character', newCharacterOwner.id);
    }
  }, [navigation, newCharacterOwner]);

  const renderHeaderRight = useCallback(
    () =>
      canEdit ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ItemJourneyForm', { itemJourneyId })}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="pencil-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null,
    [navigation, itemJourneyId, colors.text, canEdit],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight]),
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_item_journey_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!itemJourney) {
    return (
      <ScreenError
        padded
        message={t('item_journey_data_missing')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <TagChipList tags={itemJourneyTags} />

      {relatedItem && (
        <TouchableOpacity onPress={handleItemPress} style={styles.relationLink} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <DetailField label={t('item')} value={relatedItem.name} />
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      <CommentableDetailField
        storyId={itemJourney.storyId}
        label={t('item_state')}
        value={itemJourney.newState || t('common_na')}
        comments={commentsByField['newState'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'newState' },
            { ...input, contentSnapshot: itemJourney.newState || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />
      <CommentableDetailField
        storyId={itemJourney.storyId}
        label={t('extra_notes')}
        value={itemJourney.extraNotes || t('common_na')}
        comments={commentsByField['extraNotes'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'extraNotes' },
            { ...input, contentSnapshot: itemJourney.extraNotes || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />
      {relatedScene && (
        <TouchableOpacity
          onPress={handleScenePress}
          style={styles.relationLink}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <DetailField label={t('scene')} value={relatedScene.name} />
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
            <DetailField label={t('new_character_owner')} value={newCharacterOwner.name} />
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

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemJourneyDetailScreen;
