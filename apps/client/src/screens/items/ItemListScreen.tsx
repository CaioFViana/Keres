import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ItemListItem from '@/src/components/features/list-items/ItemListItem';
import ItemJourneyRows from '@/src/components/features/item-journeys/ItemJourneyRows';
import { useDrizzle } from '@/src/db';
import type {
  ChapterSelect,
  ChoiceSelect,
  ItemJourneySelect,
  SceneSelect,
  TagSelect,
} from '@/src/db/schema';
import type { ItemSelect } from '@/src/db/schemas/items';
import { useScreenTour } from '@/src/guides/useScreenTour';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import OutsideArcNotice from '@/src/components/features/arcs/OutsideArcNotice';
import { useEntityArcScope } from '@/src/hooks/arcs/useEntityArcScope';
import { useEntityListScreen } from '@/src/hooks/lists/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '@/src/hooks/character/useOpenPresenceMatrixViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useTagChangeReload } from '@/src/hooks/lists/useTagChangeReload';
import type {
  ItemStackParamList,
  MainSystemDrawerParamList,
} from '@/src/navigation/MainSystemStack';
import { useItemStore } from '@/src/state/story/itemStore';
import { useStoryStore } from '@/src/state/story/storyStore';
import { type ThemeColors } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { createTagService } from '@/src/services/storymanagement/notes-tags-comments/TagService';
import { createTagRelationService } from '@/src/services/storymanagement/relations/TagRelationService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { orderItemJourneysByNarrative } from '@/src/utils/entity/itemJourneyOrder';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import GuideAnchor from '@/src/guides/GuideAnchor';

export type ItemsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemsStack'>,
  NativeStackNavigationProp<ItemStackParamList, 'ItemDetail'>
>;

const ItemListScreen = () => {
  useBackButtonHandler();
  useScreenTour('ItemsStack');
  const { t } = useTranslation();
  const { agree, term } = useStoryVocabulary();
  const drizzleDb = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const navigation = useNavigation<ItemsScreenNavigationProp>();
  const { openItemList } = useOpenPresenceMatrixViewer();

  const { listProps, items, isInitialLoading, error, storyId, handleToggleFavorite, findMatching } =
    useEntityListScreen({
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
  const [characterNamesById, setCharacterNamesById] = useState<Map<string, string>>(new Map());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadJourneys` only reaches setState after `await`; the rule cannot verify across the callback boundary.
    loadJourneys();
  }, [loadJourneys]);

  const loadCharacterNames = useCallback(async () => {
    if (!drizzleDb || !storyId) {
      setCharacterNamesById(new Map());
      return;
    }
    const characters = await createCharacterService(drizzleDb).getAllByStoryId(storyId);
    setCharacterNamesById(new Map(characters.map((character) => [character.id, character.name])));
  }, [drizzleDb, storyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadCharacterNames` clears synchronously only when db/story are missing; everything else waits for `await`. The rule cannot verify across the callback boundary.
    loadCharacterNames();
  }, [loadCharacterNames]);
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

  useEffect(() => {
    const refreshCharacterNames = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadCharacterNames();
    };
    entityEventEmitter.on('character_changed', refreshCharacterNames);
    return () => entityEventEmitter.off('character_changed', refreshCharacterNames);
  }, [loadCharacterNames, storyId]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadTags` clears synchronously only when db/story are missing; everything else waits for `await`. The rule cannot verify across the callback boundary.
    loadTags();
  }, [loadTags]);

  useTagChangeReload(storyId, loadTags);

  const foundItems = useMemo(
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
  const {
    data: itemsWithTags,
    outsideCount,
    expanded: showingOtherArcs,
    toggle: toggleOtherArcs,
    previewCount,
  } = useEntityArcScope({
    storyId,
    kind: 'item',
    rows: foundItems,
    searchTerm: listProps.currentSearchTerm,
    findMatching,
  });

  const handleViewDetails = useCallback(
    (itemId: string) => {
      navigation.navigate('ItemDetail', { itemId });
    },
    [navigation],
  );
  const handleOpenJourney = useCallback(
    (itemJourneyId: string) => navigation.navigate('ItemJourneyDetail', { itemJourneyId }),
    [navigation],
  );
  const handleAddJourney = useCallback(
    (itemId: string) => navigation.navigate('ItemJourneyForm', { itemId }),
    [navigation],
  );

  const characterOwnerLabels = useMemo(() => {
    const character = term('Character');
    const ending = agree('Character', { masculine: 'o', feminine: 'a', neutral: 'o' });
    return {
      owner: t('item_character_owner_label', { character, ending }),
      unknown: t('item_unknown_character_owner', { character, ending }),
    };
  }, [agree, t, term]);

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
          characterOwnerName={
            item.characterOwnerId ? characterNamesById.get(item.characterOwnerId) : undefined
          }
          characterOwnerLabel={characterOwnerLabels.owner}
          unknownCharacterOwnerLabel={characterOwnerLabels.unknown}
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
      characterOwnerLabels,
      chapters,
      characterNamesById,
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

  const styles = useThemedStyles(createStyles);

  useScreenHeader({
    target: 'parent',
    title: term('Item', true),
    actions: [
      {
        id: 'action-0',
        icon: 'map-outline',
        label: t('presence_matrix_item_title'),
        onPress: openItemList,
        visible: !!(
          (selectedStory?.type === 'linear' || canEdit) &&
          selectedStory?.type === 'linear'
        ),
      },
      {
        id: 'action-1',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('ItemForm', {}),
        visible: !!((selectedStory?.type === 'linear' || canEdit) && canEdit),
      },
    ],
  });

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
      <GuideAnchor screen="Items" part="list" style={{ flex: 1 }}>
        <GenericFilterSortList
          {...listProps}
          onPreviewCount={previewCount}
          data={itemsWithTags}
          resultsNotice={
            <OutsideArcNotice
              count={outsideCount}
              expanded={showingOtherArcs}
              onToggle={toggleOtherArcs}
            />
          }
          renderItem={memoizedItemListItem}
          keyExtractor={(item) => item.id}
          searchPlaceholder={t('vocabulary_search_entities', { entities: term('Item', true) })}
          filterOptions={allTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color,
          }))}
          onFilterChange={setActiveTagIds}
          selectedFilterValues={activeTagIds}
          sortOptions={memoizedSortOptions}
          entityName="Item"
          storyId={storyId || ''}
          emptyStateTitle={t('items_empty_title')}
          emptyStateMessage={t('items_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('items_empty_create'),
                    onPress: () => navigation.navigate('ItemForm', {}),
                    testID: 'empty-create-item',
                  },
                ]
              : []
          }
        />
      </GuideAnchor>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({ ...commonScreenStyleDefs(colors) });

export default ItemListScreen;
