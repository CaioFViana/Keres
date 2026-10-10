import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import ChapterReorderModal from '@/src/components/features/chapters/ChapterReorderModal/ChapterReorderModal';
import QuickAddSceneModal from '@/src/components/features/chapters/QuickAddSceneModal';
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
import OutsideArcNotice from '../../../components/features/arcs/OutsideArcNotice';
import { useArcSearchScope } from '../../../hooks/useArcSearchScope';
import { chapterBelongsToArc } from '../../../utils/storyArcFilter';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../../hooks/useEntityListScreen';
import { useStoryRole } from '../../../hooks/useStoryRole';
import { useTagChangeReload } from '../../../hooks/useTagChangeReload';
import type {
  NarrativeElementsStackParamList,
  MainSystemDrawerParamList,
} from '../../../navigation/MainSystemStack';
import { useChapterStore } from '../../../state/chapterStore';
import { useSceneStore } from '../../../state/sceneStore';
import { useStoryStore } from '../../../state/storyStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import type { ThemeColors } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { isUnchapteredGroup, UNCHAPTERED_GROUP_ID } from '../../../utils/narrativeSceneOrder';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createTagService } from '../../../services/storymanagement/TagService';
import { createTagRelationService } from '../../../services/storymanagement/TagRelationService';
import { useStoryVocabulary } from '../../../vocabulary/useStoryVocabulary';
import {
  createChapterListItemRenderer,
  scenesShownForChapter,
} from './createChapterListItemRenderer';
import { useAdvancedNarrativeMatches } from './useAdvancedNarrativeMatches';
import { useVisibleChapters } from './useVisibleChapters';

export type NarrativeElementsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NarrativeElementsStack'>,
  NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChapterDetail'>
>;

const NarrativeElementsListScreen = () => {
  useBackButtonHandler();
  useScreenTour('NarrativeElementsStack');
  const listAnchorRef = useScreenAnchor('NarrativeElements', 'list');
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const activeArcId = useStoryStore((state) => state.activeArcId);
  const effectiveArc = useStoryStore((state) => state.effectiveArc);
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
  const { userId } = useUserSettingsStore();
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

  const advancedMatches = useAdvancedNarrativeMatches({
    storyId,
    advancedSearchCriteria,
    outlineChapters,
    scenes,
    choices,
  });

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

  useTagChangeReload(storyId, loadTags);
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
  // Title-only capture lives in a modal: the outline group cannot grow to fit an inline
  // row, which pushed the new scene below the fold until the writer closed it. The modal
  // stays open across adds (type, add, repeat); the scene is completed by editing it
  // later - including filing an unchaptered one into a chapter.
  const [quickAddChapterId, setQuickAddChapterId] = useState<string | null>(null);
  const handleQuickAddPress = useCallback(
    (chapterId: string) => setQuickAddChapterId(chapterId),
    [],
  );
  // Rejects on failure so the row keeps the typed title instead of dropping it.
  const handleQuickAddSubmit = useCallback(
    async (name: string) => {
      if (!storyId || !userId || !canEdit || !quickAddChapterId) return;
      try {
        await createSceneService(db).createScene(userId, {
          storyId,
          chapterId: isUnchapteredGroup(quickAddChapterId) ? null : quickAddChapterId,
          name,
        });
        await loadOutline();
      } catch (error) {
        console.error('Failed to quick-add scene:', error);
        AppAlert.alert(t('error'), t('failed_to_quick_add_scene'));
        throw error;
      }
    },
    [storyId, userId, canEdit, quickAddChapterId, db, loadOutline, t],
  );
  const quickAddGroupName =
    quickAddChapterId && !isUnchapteredGroup(quickAddChapterId)
      ? (outlineChapters.find((chapter) => chapter.id === quickAddChapterId)?.name ?? '')
      : t('unchaptered_scenes');
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

  const allVisibleChapters = useVisibleChapters({
    outlineChapters,
    scenes: scenesWithFavoriteState,
    choices,
    tagsByChapterId,
    tagsBySceneId,
    activeTagIds,
    advancedMatches,
    favoriteFilterState,
    searchQuery,
    activeSort,
    sortDirection,
    canEdit,
    storyId,
    t,
  });
  // The outline is the active arc's; a search also counts what it found in the others.
  const inActiveArc = useCallback(
    (chapter: ChapterSelect) =>
      chapter.id === UNCHAPTERED_GROUP_ID || chapterBelongsToArc(chapter, activeArcId),
    [activeArcId],
  );
  const {
    data: visibleChapters,
    outsideCount,
    expanded: showingOtherArcs,
    toggle: toggleOtherArcs,
  } = useArcSearchScope(allVisibleChapters, inActiveArc, searchQuery);

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
        handleQuickAddPress,
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
      handleQuickAddPress,
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

  const styles = useThemedStyles(createStyles);

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
      // A campaign opens its next session in one step: the real date, and the first scene waiting.
      // Other works do not even carry the action.
      ...(effectiveArc?.medium === 'campaign'
        ? [
            {
              id: 'new-session',
              icon: 'play-circle-outline' as const,
              label: t('new_session_title', { session: term('Chapter') }),
              onPress: () => navigation.navigate('NewSession'),
              visible: !!canEdit,
            },
          ]
        : []),
      // A screenplay can be brought in from a Fountain file; no other work carries the action.
      ...(effectiveArc?.medium === 'screenplay'
        ? [
            {
              id: 'import-fountain',
              icon: 'document-attach-outline' as const,
              label: t('fountain_import_title'),
              onPress: () => navigation.navigate('FountainImport'),
              visible: !!canEdit,
            },
          ]
        : []),
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
          // The rows here are chapters with their scenes, filtered by three scopes at once; no count of one
          // store's rows would match what the list shows.
          onPreviewCount={undefined}
          data={visibleChapters}
          resultsNotice={
            <OutsideArcNotice
              count={outsideCount}
              expanded={showingOtherArcs}
              onToggle={toggleOtherArcs}
            />
          }
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
      <QuickAddSceneModal
        visible={quickAddChapterId !== null}
        groupName={quickAddGroupName}
        onSubmit={handleQuickAddSubmit}
        onClose={() => setQuickAddChapterId(null)}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({ ...commonScreenStyleDefs(colors) });

export default NarrativeElementsListScreen;
