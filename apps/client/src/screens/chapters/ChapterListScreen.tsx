import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ChapterReorderModal from '@/src/components/features/chapters/ChapterReorderModal/ChapterReorderModal'; // Import the modal
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import ChapterListItem from '@/src/components/features/list-items/ChapterListItem';
import ChapterScenesList from '@/src/components/features/chapters/ChapterScenesList';
import SceneReorderModal from '@/src/components/features/scenes/SceneReorderModal/SceneReorderModal';
import { useDrizzle } from '../../db';
import { ChapterSelect, ChoiceSelect, SceneSelect, TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useOpenStoryTimelineViewer } from '../../hooks/useOpenStoryTimelineViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { ChapterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useChapterStore } from '../../state/chapterStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { setDocumentTitle } from '../../utils/documentTitle';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { createChapterService } from '../../services/storymanagement/ChapterService';
import { createTagService } from '../../services/storymanagement/TagService';
import { createTagRelationService } from '../../services/storymanagement/TagRelationService';

export type ChaptersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ChaptersStack'>,
  NativeStackNavigationProp<ChapterStackParamList, 'ChapterDetail'>
>;

const matchesSceneQuery = (scene: SceneSelect, query: string) =>
  [scene.name, scene.summary, scene.extraNotes].some((value) =>
    value?.toLocaleLowerCase().includes(query),
  );

const scenesShownForChapter = (chapterId: string, allScenes: SceneSelect[], query: string) => {
  const chapterScenes = allScenes.filter((scene) => scene.chapterId === chapterId);
  if (!query) return chapterScenes;
  const matchingScenes = chapterScenes.filter((scene) => matchesSceneQuery(scene, query));
  return matchingScenes.length > 0 ? matchingScenes : chapterScenes;
};

const ChapterListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const navigation = useNavigation<ChaptersScreenNavigationProp>();
  const openStoryTimeline = useOpenStoryTimelineViewer();

  const {
    items: chapters,
    loading,
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

  const [isReorderModalVisible, setIsReorderModalVisible] = useState(false);
  const [outlineChapters, setOutlineChapters] = useState<ChapterSelect[]>([]);
  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [reorderChapterId, setReorderChapterId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [tagsByChapterId, setTagsByChapterId] = useState<Map<string, TagSelect[]>>(new Map());
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);

  const loadOutline = useCallback(async () => {
    if (!storyId) return;
    const [loadedChapters, loadedScenes, loadedChoices] = await Promise.all([
      createChapterService(db).getAllByStoryId(storyId),
      createSceneService(db).getAllByStoryId(storyId),
      createChoiceService(db).getAllByStoryId(storyId),
    ]);
    setOutlineChapters(loadedChapters);
    setScenes(loadedScenes);
    setChoices(loadedChoices.filter((choice) => !choice.isDeleted));
  }, [db, storyId]);

  useEffect(() => {
    loadOutline();
  }, [loadOutline]);

  const loadTags = useCallback(async () => {
    if (!storyId) {
      setAllTags([]);
      setTagsByChapterId(new Map());
      return;
    }
    const relationService = createTagRelationService(db);
    const [loadedTags, chapterTags] = await Promise.all([
      createTagService(db).getTagsByStoryId(storyId),
      Promise.all(
        outlineChapters.map((chapter) =>
          relationService.getTagsForEntity(storyId, chapter.id, 'Chapter'),
        ),
      ),
    ]);
    setAllTags(loadedTags);
    setTagsByChapterId(
      new Map(outlineChapters.map((chapter, index) => [chapter.id, chapterTags[index]])),
    );
  }, [db, outlineChapters, storyId]);

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
    (chapterId: string) => navigation.navigate('SceneForm', { chapterId }),
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

  const visibleChapters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const favoriteOverrides = new Map(
      (chapters as ChapterSelect[]).map((chapter) => [chapter.id, chapter.isFavorite]),
    );
    const base: ChapterSelect[] = Object.keys(advancedSearchCriteria).length
      ? (chapters as ChapterSelect[])
      : outlineChapters;
    const filtered = base.filter((chapter) => {
      const isFavorite = favoriteOverrides.get(chapter.id) ?? chapter.isFavorite;
      if (favoriteFilterState === 'favorite' && !isFavorite) return false;
      if (favoriteFilterState === 'not-favorite' && isFavorite) return false;
      if (
        activeTagIds.length > 0 &&
        !(tagsByChapterId.get(chapter.id) ?? []).some((tag) => activeTagIds.includes(tag.id))
      ) {
        return false;
      }
      if (!query) return true;
      const chapterMatches = [chapter.name, chapter.summary, chapter.extraNotes].some((value) =>
        value?.toLocaleLowerCase().includes(query),
      );
      return (
        chapterMatches ||
        scenes.some((scene) => scene.chapterId === chapter.id && matchesSceneQuery(scene, query))
      );
    });
    const direction = sortDirection === 'desc' ? -1 : 1;
    return [...filtered]
      .sort((a, b) => {
        const by =
          activeSort === 'name'
            ? a.name.localeCompare(b.name)
            : activeSort === 'createdAt'
              ? a.createdAt.getTime() - b.createdAt.getTime()
              : activeSort === 'updatedAt'
                ? a.updatedAt.getTime() - b.updatedAt.getTime()
                : a.index - b.index;
        return by * direction;
      })
      .map((chapter) => ({
        ...chapter,
        isFavorite: favoriteOverrides.get(chapter.id) ?? chapter.isFavorite,
      }));
  }, [
    activeSort,
    activeTagIds,
    advancedSearchCriteria,
    chapters,
    favoriteFilterState,
    outlineChapters,
    scenes,
    searchQuery,
    sortDirection,
    tagsByChapterId,
  ]);

  const memoizedChapterListItem = useCallback(
    ({ item }: { item: ChapterSelect }) => {
      const query = searchQuery.trim().toLocaleLowerCase();
      const allChapterScenes = scenesWithFavoriteState.filter(
        (scene) => scene.chapterId === item.id,
      );
      const chapterScenes = scenesShownForChapter(item.id, scenesWithFavoriteState, query);
      const hasSceneMatch = query
        ? scenesWithFavoriteState.some(
            (scene) => scene.chapterId === item.id && matchesSceneQuery(scene, query),
          )
        : false;

      return (
        <ChapterListItem
          chapter={item}
          onViewDetails={handleViewDetails}
          onToggleFavorite={handleToggleFavorite}
          initialExpanded={hasSceneMatch}
          tags={tagsByChapterId.get(item.id)}
          renderScenes={({ expandedSceneIds, onSceneExpandedChange }) => (
            <ChapterScenesList
              storyType={selectedStory?.type}
              scenes={chapterScenes}
              allChapterScenes={allChapterScenes}
              choices={choices}
              canEdit={canEdit}
              onOpenScene={handleOpenScene}
              onToggleFavorite={handleToggleSceneFavorite}
              onAddScene={() => handleAddScene(item.id)}
              onReorderScenes={() => setReorderChapterId(item.id)}
              expandedSceneIds={expandedSceneIds}
              onSceneExpandedChange={onSceneExpandedChange}
            />
          )}
        />
      );
    },
    [
      canEdit,
      choices,
      handleAddScene,
      handleOpenScene,
      handleToggleFavorite,
      handleToggleSceneFavorite,
      handleViewDetails,
      scenesWithFavoriteState,
      selectedStory?.type,
      searchQuery,
      tagsByChapterId,
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

  const visibleSceneCount = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return visibleChapters.reduce(
      (total, chapter) =>
        total + scenesShownForChapter(chapter.id, scenesWithFavoriteState, query).length,
      0,
    );
  }, [scenesWithFavoriteState, searchQuery, visibleChapters]);

  const handleReorderPress = useCallback(() => {
    setIsReorderModalVisible(true);
  }, []);

  const handleReorderConfirm = useCallback(
    async (newOrder: { id: string; newIndex: number }[]) => {
      await reorderChapters(newOrder);
      setIsReorderModalVisible(false);
    },
    [reorderChapters],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRightContainer: {
      flexDirection: 'row',
      marginRight: 15,
    },
    headerButton: {
      marginLeft: 15,
    },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('chapters_title'));
      navigation.getParent()?.setOptions({
        title: t('chapters_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {selectedStory?.type === 'linear' && (
              <TouchableOpacity onPress={openStoryTimeline} style={styles.headerButton}>
                <Ionicons name="bar-chart-outline" size={23} color={colors.text} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity onPress={handleReorderPress} style={styles.headerButton}>
                <Ionicons name="swap-vertical" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ChapterForm', { chapterId: undefined })}
                style={styles.headerButton}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [
      navigation,
      colors.text,
      t,
      handleReorderPress,
      styles.headerButton,
      styles.headerRightContainer,
      canEdit,
      openStoryTimeline,
      selectedStory?.type,
    ]),
  );

  // The chapter store is still queried for advanced filters. The outline itself is the stable
  // source for this composite Chapter + Scene screen, so a debounced scene-name search must not
  // temporarily replace the whole screen (and its focused search field) with a loading state.
  if (loading && outlineChapters.length === 0) {
    return <ScreenLoading message={t('loading_chapters')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={visibleChapters}
        renderItem={memoizedChapterListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('chapter_outline_search_placeholder')}
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
        entityName="Chapter"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        resultsMeta={t('chapter_outline_scene_count', { count: visibleSceneCount })}
      />
      <ChapterReorderModal
        isVisible={isReorderModalVisible}
        onClose={() => setIsReorderModalVisible(false)}
        chapters={chapters}
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

export default ChapterListScreen;
