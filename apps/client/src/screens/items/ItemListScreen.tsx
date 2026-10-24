import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
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
import { useScreenTour } from '@/src/hooks/guides/useScreenTour';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import OutsideArcNotice from '@/src/components/features/arcs/OutsideArcNotice';
import { useEntityArcScope } from '@/src/hooks/arcs/useEntityArcScope';
import { useEntityListScreen } from '@/src/hooks/lists/useEntityListScreen';
import { useOpenPresenceMatrixViewer } from '@/src/hooks/character/useOpenPresenceMatrixViewer';
import { useStoryRole } from '@/src/hooks/story/useStoryRole';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import type {
  ItemStackParamList,
  MainSystemDrawerParamList,
} from '@/src/navigation/drawer/MainSystemDrawer';
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
import { orderItemJourneysByNarrative } from '@/src/utils/entity/itemJourneyOrder';
import { useStoryVocabulary } from '@/src/hooks/vocabulary/useStoryVocabulary';
import GuideAnchor from '@/src/components/features/guides/GuideAnchor';

const JOURNEY_EVENTS = [
  'item_journey_changed',
  'scene_changed',
  'chapter_changed',
  'choice_changed',
] as const;
const CHARACTER_EVENTS = ['character_changed'] as const;
const TAG_EVENTS = ['tag_changed', 'tag_relation_changed'] as const;
const NO_JOURNEY_DATA: {
  journeys: ItemJourneySelect[];
  scenes: SceneSelect[];
  chapters: ChapterSelect[];
  choices: ChoiceSelect[];
} = { journeys: [], scenes: [], chapters: [], choices: [] };
const NO_CHARACTER_NAMES = new Map<string, string>();
const NO_TAG_DATA: { allTags: TagSelect[]; tagsByItemId: Map<string, TagSelect[]> } = {
  allTags: [],
  tagsByItemId: new Map(),
};

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
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const loadJourneys = useMemo(
    () =>
      storyId
        ? async () => {
            const [journeys, scenes, chapters, loadedChoices] = await Promise.all([
              createItemJourneyService(drizzleDb).getAllByStoryId(storyId),
              createSceneService(drizzleDb).getAllByStoryId(storyId),
              createChapterService(drizzleDb).getAllByStoryId(storyId),
              createChoiceService(drizzleDb).getAllByStoryId(storyId),
            ]);
            return {
              journeys,
              scenes,
              chapters,
              choices: loadedChoices.filter((choice) => !choice.isDeleted),
            };
          }
        : null,
    [drizzleDb, storyId],
  );
  const {
    data: { journeys, scenes, chapters, choices },
  } = useLoadedResource({
    load: loadJourneys,
    initial: NO_JOURNEY_DATA,
    events: JOURNEY_EVENTS,
    storyId,
    label: 'item journeys',
  });

  const loadCharacterNames = useMemo(
    () =>
      storyId
        ? async () => {
            const characters = await createCharacterService(drizzleDb).getAllByStoryId(storyId);
            return new Map(characters.map((character) => [character.id, character.name]));
          }
        : null,
    [drizzleDb, storyId],
  );
  const { data: characterNamesById } = useLoadedResource({
    load: loadCharacterNames,
    initial: NO_CHARACTER_NAMES,
    events: CHARACTER_EVENTS,
    storyId,
    label: 'character names',
  });

  // The tags are read for the items on screen, so the read follows `items` without blanking the tags.
  const loadTags = useMemo(
    () =>
      storyId
        ? async (itemsToTag: unknown) => {
            const tagged = itemsToTag as ItemSelect[];
            const tagService = createTagService(drizzleDb);
            const relationService = createTagRelationService(drizzleDb);
            const [allTags, itemTags] = await Promise.all([
              tagService.getTagsByStoryId(storyId),
              Promise.all(
                tagged.map((item) => relationService.getTagsForEntity(storyId, item.id, 'Item')),
              ),
            ]);
            return {
              allTags,
              tagsByItemId: new Map(tagged.map((item, index) => [item.id, itemTags[index]])),
            };
          }
        : null,
    [drizzleDb, storyId],
  );
  const {
    data: { allTags, tagsByItemId },
  } = useLoadedResource({
    load: loadTags,
    initial: NO_TAG_DATA,
    events: TAG_EVENTS,
    storyId,
    refreshKey: items,
    label: 'item tags',
  });

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
