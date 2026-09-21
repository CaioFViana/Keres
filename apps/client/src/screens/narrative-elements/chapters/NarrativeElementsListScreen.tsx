import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import ChapterReorderModal from '@/src/components/features/chapters/ChapterReorderModal/ChapterReorderModal'; // Import the modal
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import SceneReorderModal from '@/src/components/features/scenes/SceneReorderModal/SceneReorderModal';
import { useDrizzle } from '../../../db';
import type { ChapterType } from '@keres/shared';
import type { ChapterSelect, ChoiceSelect, SceneSelect, TagSelect } from '../../../db/schema';
import { AppAlert } from '../../../utils/AppAlert';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useScreenTour } from '../../../guides/useScreenTour';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../../hooks/useEntityListScreen';
import { useStoryRole } from '../../../hooks/useStoryRole';
import type {
  NarrativeElementsStackParamList,
  MainSystemDrawerParamList,
} from '../../../navigation/MainSystemStack';
import { useChapterStore } from '../../../state/chapterStore';
import { useSceneStore } from '../../../state/sceneStore';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { isUnchapteredGroup } from '../../../utils/narrativeSceneOrder';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createTagService } from '../../../services/storymanagement/TagService';
import { createTagRelationService } from '../../../services/storymanagement/TagRelationService';
import { useStoryVocabulary } from '../../../vocabulary/useStoryVocabulary';
import {
  createChapterListItemRenderer,
  type AdvancedNarrativeMatches,
  scenesShownForChapter,
} from './createChapterListItemRenderer';
import { useVisibleChapters } from './useVisibleChapters';

export type NarrativeElementsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NarrativeElementsStack'>,
  NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChapterDetail'>
>;

const splitNarrativeCriteria = (criteria: Record<string, unknown>, prefix: string) =>
  Object.fromEntries(
    Object.entries(criteria)
      .filter(([key, value]) => key.startsWith(`${prefix}:`) && value !== undefined && value !== '')
      .map(([key, value]) => [key.slice(prefix.length + 1), value]),
  );

const NarrativeElementsListScreen = () => {
  useBackButtonHandler();
  useScreenTour('NarrativeElementsStack');
  const listAnchorRef = useScreenAnchor('NarrativeElements', 'list');
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();

  const {
    listProps,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useChapterStore,
    collectionKey: 'chapters',
    changeEvent: 'chapter_changed',
  });

  const { canEdit } = useStoryRole(storyId);
  const storedScenes = useSceneStore((state) => state.scenes);
  const fetchStoredScenes = useSceneStore((state) => state.fetchScenes);
  const toggleSceneFavorite = useSceneStore((state) => state.toggleFavorite);
  const reorderScenes = useSceneStore((state) => state.reorderScenes);
  const setSceneDbAndStoryId = useSceneStore((state) => state.setDbAndStoryId);
  const initializeSceneService = useSceneStore((state) => state.initializeService);

  // Reordering isn't part of the shared list wiring, so it comes straight from the store.
  const reorderChapters = useChapterStore((state) => state.reorderChapters);

  /** Which space the reorder modal is editing - the two are numbered independently. */
  const [reorderingType, setReorderingType] = useState<ChapterType | null>(null);
  const [outlineChapters, setOutlineChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [reorderChapterId, setReorderChapterId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [tagsByChapterId, setTagsByChapterId] = useState<Map<string, TagSelect[]>>(new Map());
  const [tagsBySceneId, setTagsBySceneId] = useState<Map<string, TagSelect[]>>(new Map());
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [advancedMatches, setAdvancedMatches] = useState<AdvancedNarrativeMatches | null>(null);

  const loadOutline = useCallback(async () => {
    if (!storyId) return;
    const [loadedChapters, loadedScenes, loadedChoices] = await Promise.all([
      // Both kinds: the outline is the story's containers, and the service groups them.
      createChapterService(db).getAllByStoryId(storyId, null),
      createSceneService(db).getAllByStoryId(storyId),
      createChoiceService(db).getAllByStoryId(storyId),
    ]);
    setOutlineChapters(loadedChapters);
    setScenes(loadedScenes);
    setChoices(loadedChoices.filter((choice) => !choice.isDeleted));
  }, [db, storyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadOutline` only reaches setState after `await`; the rule cannot verify across the callback boundary.
    loadOutline();
  }, [loadOutline]);

  const narrativeCriteria = useMemo(() => {
    const chapterCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'chapter');
    const sceneCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'scene');
    const choiceCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'choice');
    const hasCriteria = [chapterCriteria, sceneCriteria, choiceCriteria].some(
      (criteria) => Object.keys(criteria).length > 0,
    );
    return { chapterCriteria, sceneCriteria, choiceCriteria, hasCriteria };
  }, [advancedSearchCriteria]);

  const [prevStoryId, setPrevStoryId] = useState(storyId);
  const [prevAdvancedSearchCriteria, setPrevAdvancedSearchCriteria] =
    useState(advancedSearchCriteria);
  if (storyId !== prevStoryId || advancedSearchCriteria !== prevAdvancedSearchCriteria) {
    setPrevStoryId(storyId);
    setPrevAdvancedSearchCriteria(advancedSearchCriteria);
    if (!storyId || !narrativeCriteria.hasCriteria) {
      setAdvancedMatches(null);
    }
  }

  useEffect(() => {
    if (!storyId) {
      return;
    }
    const { chapterCriteria, sceneCriteria, choiceCriteria, hasCriteria } = narrativeCriteria;
    if (!hasCriteria) {
      return;
    }

    let cancelled = false;
    const loadAdvancedMatches = async () => {
      const [matchedChapters, matchedScenes, matchedChoices] = await Promise.all([
        Object.keys(chapterCriteria).length
          ? createChapterService(db).getChaptersByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              chapterCriteria,
            )
          : Promise.resolve(outlineChapters),
        Object.keys(sceneCriteria).length
          ? createSceneService(db).getScenesByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              sceneCriteria,
            )
          : Promise.resolve(scenes),
        Object.keys(choiceCriteria).length
          ? createChoiceService(db).getChoicesByStoryId(
              storyId,
              undefined,
              undefined,
              undefined,
              'all',
              choiceCriteria,
            )
          : Promise.resolve(choices),
      ]);
      if (!cancelled) {
        setAdvancedMatches({
          chapterIds: new Set(matchedChapters.map((chapter) => chapter.id)),
          sceneIds: new Set(matchedScenes.map((scene) => scene.id)),
          choiceSourceSceneIds: new Set(matchedChoices.map((choice) => choice.sceneId)),
        });
      }
    };
    loadAdvancedMatches();
    return () => {
      cancelled = true;
    };
  }, [narrativeCriteria, choices, db, outlineChapters, scenes, storyId]);

  const loadTags = useCallback(async () => {
    if (!storyId) {
      setAllTags([]);
      setTagsByChapterId(new Map());
      setTagsBySceneId(new Map());
      return;
    }
    const relationService = createTagRelationService(db);
    const [loadedTags, chapterTags, sceneTags] = await Promise.all([
      createTagService(db).getTagsByStoryId(storyId),
      Promise.all(
        outlineChapters.map((chapter) =>
          relationService.getTagsForEntity(storyId, chapter.id, 'Chapter'),
        ),
      ),
      Promise.all(
        scenes.map((scene) => relationService.getTagsForEntity(storyId, scene.id, 'Scene')),
      ),
    ]);
    setAllTags(loadedTags);
    setTagsByChapterId(
      new Map(outlineChapters.map((chapter, index) => [chapter.id, chapterTags[index]])),
    );
    setTagsBySceneId(new Map(scenes.map((scene, index) => [scene.id, sceneTags[index]])));
  }, [db, outlineChapters, scenes, storyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadTags` clears synchronously only when no story is selected; everything else waits for `await`. The rule cannot verify across the callback boundary.
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
  useEffect(() => {
    if (storyId) {
      setSceneDbAndStoryId(db, storyId);
      initializeSceneService();
      fetchStoredScenes();
    }
  }, [db, fetchStoredScenes, initializeSceneService, setSceneDbAndStoryId, storyId]);
  useEffect(() => {
    const refresh = (changedStoryId: string) => {
      if (changedStoryId === storyId) loadOutline();
    };
    entityEventEmitter.on('scene_changed', refresh);
    entityEventEmitter.on('chapter_changed', refresh);
    entityEventEmitter.on('choice_changed', refresh);
    return () => {
      entityEventEmitter.off('scene_changed', refresh);
      entityEventEmitter.off('chapter_changed', refresh);
      entityEventEmitter.off('choice_changed', refresh);
    };
  }, [loadOutline, storyId]);

  const handleToggleFavorite = useCallback(
    async (chapterId: string, isFavorite: boolean) => {
      // The outline is rendered independently from the chapter store so it can include scenes.
      // Update it optimistically too; otherwise the star stays stale until the next reload.
      setOutlineChapters((previous) =>
        previous.map((chapter) =>
          chapter.id === chapterId ? { ...chapter, isFavorite } : chapter,
        ),
      );
      await toggleFavorite(chapterId, isFavorite);
      await loadOutline();
    },
    [loadOutline, toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (chapterId: string) => {
      navigation.navigate('ChapterDetail', { chapterId });
    },
    [navigation],
  );

  const handleOpenScene = useCallback(
    (sceneId: string) => navigation.navigate('SceneDetail', { sceneId }),
    [navigation],
  );
  const handleAddScene = useCallback(
    (chapterId: string) =>
      navigation.navigate('SceneForm', {
        chapterId: isUnchapteredGroup(chapterId) ? undefined : chapterId,
      }),
    [navigation],
  );
  const handleToggleSceneFavorite = useCallback(
    async (sceneId: string, isFavorite: boolean) => {
      setScenes((previous) =>
        previous.map((scene) => (scene.id === sceneId ? { ...scene, isFavorite } : scene)),
      );
      await toggleSceneFavorite(sceneId, isFavorite);
      await loadOutline();
    },
    [loadOutline, toggleSceneFavorite],
  );
  const handleReorderScenes = useCallback(
    async (chapterId: string, nextOrder: { id: string; newIndex: number }[]) => {
      await reorderScenes(chapterId, nextOrder);
      setReorderChapterId(null);
    },
    [reorderScenes],
  );

  // Individual favourites are decorated by the entity store. The outline query intentionally
  // stays lightweight, so merge that display-only state before rendering nested scene rows.
  const scenesWithFavoriteState = useMemo(() => {
    const favoriteById = new Map(storedScenes.map((scene) => [scene.id, scene.isFavorite]));
    return scenes.map((scene) => ({
      ...scene,
      isFavorite: favoriteById.get(scene.id) ?? scene.isFavorite,
    }));
  }, [scenes, storedScenes]);

  const visibleChapters = useVisibleChapters({
    outlineChapters,
    scenes: scenesWithFavoriteState,
    choices,
    tagsByChapterId,
    tagsBySceneId,
    activeTagIds,
    advancedMatches,
    favoriteFilterState,
    activeArcId,
    searchQuery,
    activeSort,
    sortDirection,
    canEdit,
    storyId,
    t,
  });

  const memoizedChapterListItem = useMemo(
    () =>
      createChapterListItemRenderer({
        activeSort,
        activeTagIds,
        advancedMatches,
        canEdit,
        choices,
        favoriteFilterState,
        handleAddScene,
        handleOpenScene,
        handleToggleFavorite,
        handleToggleSceneFavorite,
        handleViewDetails,
        scenesWithFavoriteState,
        searchQuery,
        selectedStory,
        setReorderChapterId,
        sortDirection,
        tagsByChapterId,
        tagsBySceneId,
      }),
    [
      activeSort,
      activeTagIds,
      advancedMatches,
      canEdit,
      choices,
      favoriteFilterState,
      handleAddScene,
      handleOpenScene,
      handleToggleFavorite,
      handleToggleSceneFavorite,
      handleViewDetails,
      scenesWithFavoriteState,
      searchQuery,
      selectedStory,
      sortDirection,
      tagsByChapterId,
      tagsBySceneId,
    ],
  );

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_index'), value: 'index' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  const advancedSearchScopes = useMemo(
    () => [
      { entityName: 'Chapter' as const, prefix: 'chapter', label: term('Chapter', true) },
      { entityName: 'Scene' as const, prefix: 'scene', label: term('Scene', true) },
      ...(selectedStory?.type === 'branching'
        ? [{ entityName: 'Choice' as const, prefix: 'choice', label: term('Choice', true) }]
        : []),
    ],
    [selectedStory?.type, term],
  );

  const visibleSceneCount = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return visibleChapters.reduce(
      (total, chapter) =>
        total + scenesShownForChapter(chapter.id, scenesWithFavoriteState, query).length,
      0,
    );
  }, [scenesWithFavoriteState, searchQuery, visibleChapters]);

  /**
   * Reordering asks which space when both exist.
   *
   * Chapters and events are numbered independently, so one drag list cannot hold both: the server
   * validates each 1..N on its own and a mixed payload is a validation error whichever kind it is
   * judged against. With only one kind present there is nothing to ask.
   */
  const handleReorderPress = useCallback(() => {
    const hasEvents = outlineChapters.some((chapter) => chapter.type === 'event');
    const hasChapters = outlineChapters.some((chapter) => chapter.type !== 'event');

    if (!hasEvents) return setReorderingType('chapter');
    if (!hasChapters) return setReorderingType('event');

    AppAlert.alert(t('chapter_reorder_which'), '', [
      { text: term('Chapter', true), onPress: () => setReorderingType('chapter') },
      { text: term('Event', true), onPress: () => setReorderingType('event') },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }, [outlineChapters, t, term]);

  const handleReorderConfirm = useCallback(
    async (newOrder: { id: string; newIndex: number }[]) => {
      await reorderChapters(newOrder, reorderingType ?? 'chapter');
      setReorderingType(null);
    },
    [reorderChapters, reorderingType],
  );

  /** Only one space at a time reaches the drag list, for the reason above. */
  const reorderableContainers = useMemo(
    () =>
      reorderingType === null
        ? []
        : outlineChapters.filter((chapter) => (chapter.type ?? 'chapter') === reorderingType),
    [outlineChapters, reorderingType],
  );

  const styles = StyleSheet.create({ ...commonScreenStyleDefs(colors) });

  useScreenHeader({
    target: 'parent',
    title: t('narrative_elements_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'git-network-outline',
        label: selectedStory?.type === 'linear' ? t('story_flow_title') : t('story_map_title'),
        onPress: () => navigation.navigate('ChoiceView'),
        visible: !!selectedStory,
      },
      {
        id: 'action-1',
        icon: 'bar-chart-outline',
        label: t('story_timeline_title'),
        onPress: () => navigation.navigate('StoryTimeline'),
        visible: !!(selectedStory?.type === 'linear'),
      },
      {
        id: 'action-2',
        icon: 'swap-vertical',
        label: t('reorder_chapters_title'),
        onPress: handleReorderPress,
        visible: !!canEdit,
      },
      {
        id: 'open-manuscript',
        icon: 'book-outline',
        label: t('manuscript_title'),
        onPress: () => navigation.navigate('Manuscript', {}),
        visible: !!selectedStory,
      },
      {
        id: 'action-3',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('ChapterForm', { chapterId: undefined }),
        visible: !!canEdit,
      },
    ],
  });

  // The chapter store is still queried for advanced filters. The outline itself is the stable
  // source for this composite Chapter + Scene screen, so a debounced scene-name search must not
  // temporarily replace the whole screen (and its focused search field) with a loading state.
  if (loading && outlineChapters.length === 0) {
    return (
      <ScreenLoading
        message={t('vocabulary_loading_entities', { entities: term('Chapter', true) })}
      />
    );
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <View ref={listAnchorRef} collapsable={false} style={{ flex: 1 }}>
        <GenericFilterSortList
          {...listProps}
          data={visibleChapters}
          renderItem={memoizedChapterListItem}
          keyExtractor={(item) => item.id}
          searchPlaceholder={t('chapter_outline_search_placeholder', {
            chapters: term('Chapter', true),
            scenes: term('Scene', true),
          })}
          filterOptions={allTags.map((tag) => ({
            label: tag.name,
            value: tag.id,
            color: tag.color,
          }))}
          onFilterChange={setActiveTagIds}
          selectedFilterValues={activeTagIds}
          sortOptions={memoizedSortOptions}
          entityName="Chapter"
          storyId={storyId || ''}
          advancedSearchScopes={advancedSearchScopes}
          resultsMeta={t(
            visibleSceneCount === 1
              ? 'chapter_outline_scene_count_one'
              : 'chapter_outline_scene_count_other',
            { count: visibleSceneCount },
          )}
          emptyStateTitle={t('narrative_empty_title')}
          emptyStateMessage={t('narrative_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('narrative_empty_create'),
                    onPress: () => navigation.navigate('ChapterForm', { chapterId: undefined }),
                    testID: 'empty-create-chapter',
                  },
                ]
              : []
          }
        />
      </View>
      <ChapterReorderModal
        isVisible={reorderingType !== null}
        onClose={() => setReorderingType(null)}
        chapters={reorderableContainers}
        onReorderConfirm={handleReorderConfirm}
      />
      <SceneReorderModal
        isVisible={reorderChapterId !== null}
        onClose={() => setReorderChapterId(null)}
        storyId={storyId || ''}
        scenes={scenes}
        initialChapterId={reorderChapterId}
        onReorderConfirm={handleReorderScenes}
      />
    </View>
  );
};

export default NarrativeElementsListScreen;
