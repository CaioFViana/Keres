import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ItemListItem from '@/src/components/features/list-items/ItemListItem';
import ItemJourneyRows from '@/src/components/features/item-journeys/ItemJourneyRows';
import { useDrizzle } from '../../db';
import type {
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  SceneSelect,
  TagSelect,
} from '../../db/schema';
import type { ItemSelect } from '../../db/schemas/items';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '../../hooks/useOpenPresenceMatrixViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  ItemStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import { useItemStore } from '../../state/itemStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { createTagService } from '../../services/storymanagement/TagService';
import { createTagRelationService } from '../../services/storymanagement/TagRelationService';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { orderItemJourneysByNarrative } from '../../utils/itemJourneyOrder';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

export type ItemsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemsStack'>,
  NativeStackNavigationProp<ItemStackParamList, 'ItemDetail'>
>;

const ItemListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const { openItemList } = useOpenPresenceMatrixViewer();

  const {
    items,
    loading,
    isInitialLoading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useItemStore,
    collectionKey: 'items',
    changeEvent: 'item_changed',
  });

  const { canEdit } = useStoryRole(storyId);
  const [journeys, setJourneys] = useState<ItemJourneySelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [chapters, setChapters] = useState<ChapterSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [tagsByItemId, setTagsByItemId] = useState<Map<string, TagSelect[]>>(new Map());
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const loadJourneys = useCallback(async () => {
    if (!drizzleDb || !storyId) return;
    const [loadedJourneys, loadedScenes, loadedChapters, loadedChoices] = await Promise.all([
      createItemJourneyService(drizzleDb).getAllByStoryId(storyId),
      createSceneService(drizzleDb).getAllByStoryId(storyId),
      createChapterService(drizzleDb).getAllByStoryId(storyId),
      createChoiceService(drizzleDb).getAllByStoryId(storyId),
    ]);
    setJourneys(loadedJourneys);
    setScenes(loadedScenes);
    setChapters(loadedChapters);
    setChoices(loadedChoices.filter((choice) => !choice.isDeleted));
  }, [drizzleDb, storyId]);

  useEffect(() => {
    loadJourneys();
  }, [loadJourneys]);
  useEffect(() => {
    const refresh = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadJourneys();
    };
    entityEventEmitter.on('item_journey_changed', refresh);
    entityEventEmitter.on('scene_changed', refresh);
    entityEventEmitter.on('chapter_changed', refresh);
    entityEventEmitter.on('choice_changed', refresh);
    return () => {
      entityEventEmitter.off('item_journey_changed', refresh);
      entityEventEmitter.off('scene_changed', refresh);
      entityEventEmitter.off('chapter_changed', refresh);
      entityEventEmitter.off('choice_changed', refresh);
    };
  }, [loadJourneys, storyId]);

  const loadTags = useCallback(async () => {
    if (!drizzleDb || !storyId) {
      setAllTags([]);
      setTagsByItemId(new Map());
      return;
    }
    const tagService = createTagService(drizzleDb);
    const relationService = createTagRelationService(drizzleDb);
    const [loadedTags, itemTags] = await Promise.all([
      tagService.getTagsByStoryId(storyId),
      Promise.all(
        (items as ItemSelect[]).map((item) =>
          relationService.getTagsForEntity(storyId, item.id, 'Item'),
        ),
      ),
    ]);
    setAllTags(loadedTags);
    setTagsByItemId(
      new Map((items as ItemSelect[]).map((item, index) => [item.id, itemTags[index]])),
    );
  }, [drizzleDb, items, storyId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const refreshTags = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadTags();
    };
    entityEventEmitter.on('tag_changed', refreshTags);
    entityEventEmitter.on('tag_relation_changed', refreshTags);
    return () => {
      entityEventEmitter.off('tag_changed', refreshTags);
      entityEventEmitter.off('tag_relation_changed', refreshTags);
    };
  }, [loadTags, storyId]);

  const itemsWithTags = useMemo(
    () =>
      (items as ItemSelect[])
        .map((item) => ({ ...item, tags: tagsByItemId.get(item.id) ?? [] }))
        .filter(
          (item) =>
            activeTagIds.length === 0 ||
            item.tags.some((tag: TagSelect) => activeTagIds.includes(tag.id)),
        ),
    [activeTagIds, items, tagsByItemId],
  );

  const handleViewDetails = useCallback(
    (itemId: string) => {
      navigation.navigate('ItemDetail', { itemId });
    },
    [navigation],
  );
  const handleToggleFavorite = useCallback(
    async (itemId: string, isFavorite: boolean) => {
      await toggleFavorite(itemId, isFavorite);
    },
    [toggleFavorite],
  );
  const handleOpenJourney = useCallback(
    (itemJourneyId: string) => navigation.navigate('ItemJourneyDetail', { itemJourneyId }),
    [navigation],
  );
  const handleAddJourney = useCallback(
    (itemId: string) => navigation.navigate('ItemJourneyForm', { itemId }),
    [navigation],
  );

  const memoizedItemListItem = useCallback(
    ({ item }: { item: ItemSelect }) => {
      const orderedJourneys = orderItemJourneysByNarrative(
        journeys.filter((journey) => journey.itemId === item.id),
        selectedStory?.type ?? 'linear',
        scenes,
        choices,
        chapters,
      );
      return (
        <ItemListItem
          item={item}
          onViewDetails={handleViewDetails}
          onToggleFavorite={handleToggleFavorite}
          tags={tagsByItemId.get(item.id)}
          renderJourneys={() => (
            <ItemJourneyRows
              journeys={orderedJourneys}
              scenes={scenes}
              canEdit={canEdit}
              onOpenJourney={handleOpenJourney}
              onAddJourney={() => handleAddJourney(item.id)}
            />
          )}
        />
      );
    },
    [
      canEdit,
      chapters,
      choices,
      handleAddJourney,
      handleOpenJourney,
      handleViewDetails,
      handleToggleFavorite,
      journeys,
      scenes,
      selectedStory?.type,
      tagsByItemId,
    ],
  );

  const memoizedSortOptions = useMemo(
    () => [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_category'), value: 'category' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ],
    [t],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    headerRightContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 15, gap: 15 },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(term('Item', true));
      navigation.getParent()?.setOptions({
        title: term('Item', true),
        headerRight:
          selectedStory?.type === 'linear' || canEdit
            ? () => (
                <View style={styles.headerRightContainer}>
                  {selectedStory?.type === 'linear' && (
                    <TouchableOpacity
                      onPress={openItemList}
                      accessibilityLabel={t('presence_matrix_item_title')}
                    >
                      <Ionicons name="map-outline" size={26} color={colors.text} />
                    </TouchableOpacity>
                  )}
                  {canEdit && (
                    <TouchableOpacity onPress={() => navigation.navigate('ItemForm', {})}>
                      <Ionicons name="add" size={30} color={colors.text} />
                    </TouchableOpacity>
                  )}
                </View>
              )
            : undefined,
      });
    }, [
      navigation,
      colors.text,
      t,
      styles.headerRightContainer,
      canEdit,
      openItemList,
      selectedStory?.type,
      term,
    ]),
  );

  if (isInitialLoading) {
    return (
      <ScreenLoading message={t('vocabulary_loading_entities', { entities: term('Item', true) })} />
    );
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={itemsWithTags}
        renderItem={memoizedItemListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('vocabulary_search_entities', { entities: term('Item', true) })}
        currentSearchTerm={searchQuery}
        filterOptions={allTags.map((tag) => ({ label: tag.name, value: tag.id, color: tag.color }))}
        onFilterChange={setActiveTagIds}
        selectedFilterValues={activeTagIds}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        entityName="Item"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
      />
    </View>
  );
};

export default ItemListScreen;
