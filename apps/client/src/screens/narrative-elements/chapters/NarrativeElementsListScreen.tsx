import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { useDrizzle } from '../../../db';
import type { ChapterType } from '@keres/shared';
import type { ChapterSelect, ChoiceSelect, SceneSelect, TagSelect } from '../../../db/schema';
import { AppAlert } from '../../../utils/AppAlert';
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
import { setDocumentTitle } from '../../../utils/documentTitle';
import { isUnchapteredGroup, UNCHAPTERED_GROUP_ID } from '../../../utils/narrativeSceneOrder';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { createChapterService } from '../../../services/storymanagement/ChapterService';
import { createTagService } from '../../../services/storymanagement/TagService';
import { createTagRelationService } from '../../../services/storymanagement/TagRelationService';
import { useStoryVocabulary } from '../../../vocabulary/useStoryVocabulary';

export type NarrativeElementsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NarrativeElementsStack'>,
  NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChapterDetail'>
>;

const matchesSceneQuery = (scene: SceneSelect, query: string) =>
  [scene.name, scene.summary, scene.extraNotes].some((value) =>
    value?.toLocaleLowerCase().includes(query),
  );

const matchesChoiceQuery = (choice: ChoiceSelect, query: string) =>
  [choice.text, choice.notes].some((value) => value?.toLocaleLowerCase().includes(query));

const sceneBelongsToGroup = (scene: SceneSelect, groupId: string) =>
  isUnchapteredGroup(groupId) ? !scene.chapterId : scene.chapterId === groupId;

const scenesShownForChapter = (chapterId: string, allScenes: SceneSelect[], query: string) => {
  const chapterScenes = allScenes.filter((scene) => sceneBelongsToGroup(scene, chapterId));
  if (!query) return chapterScenes;
  const matchingScenes = chapterScenes.filter((scene) => matchesSceneQuery(scene, query));
  return matchingScenes.length > 0 ? matchingScenes : chapterScenes;
};

type AdvancedNarrativeMatches = {
  chapterIds: ReadonlySet<string>;
  sceneIds: ReadonlySet<string>;
  choiceSourceSceneIds: ReadonlySet<string>;
};

const splitNarrativeCriteria = (criteria: Record<string, unknown>, prefix: string) =>
  Object.fromEntries(
    Object.entries(criteria)
      .filter(([key, value]) => key.startsWith(`${prefix}:`) && value !== undefined && value !== '')
      .map(([key, value]) => [key.slice(prefix.length + 1), value]),
  );

const NarrativeElementsListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const db = useDrizzle();
  const selectedStory = useStoryStore((state) => state.selectedStory);
  const navigation = useNavigation<NarrativeElementsScreenNavigationProp>();

  const {
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
    loadOutline();
  }, [loadOutline]);

  useEffect(() => {
    if (!storyId) {
      setAdvancedMatches(null);
      return;
    }
    const chapterCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'chapter');
    const sceneCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'scene');
    const choiceCriteria = splitNarrativeCriteria(advancedSearchCriteria, 'choice');
    const hasCriteria = [chapterCriteria, sceneCriteria, choiceCriteria].some(
      (criteria) => Object.keys(criteria).length > 0,
    );
    if (!hasCriteria) {
      setAdvancedMatches(null);
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
  }, [advancedSearchCriteria, choices, db, outlineChapters, scenes, storyId]);

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

  const visibleChapters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filtered = outlineChapters.filter((chapter) => {
      const chapterScenes = scenesWithFavoriteState.filter(
        (scene) => scene.chapterId === chapter.id,
      );
      const hasFavorite = chapter.isFavorite || chapterScenes.some((scene) => scene.isFavorite);
      if (favoriteFilterState === 'favorite' && !hasFavorite) return false;
      if (favoriteFilterState === 'not-favorite' && hasFavorite) return false;
      if (advancedMatches) {
        if (!advancedMatches.chapterIds.has(chapter.id)) return false;
        if (!chapterScenes.some((scene) => advancedMatches.sceneIds.has(scene.id))) return false;
        if (!chapterScenes.some((scene) => advancedMatches.choiceSourceSceneIds.has(scene.id))) {
          return false;
        }
      }
      if (
        activeTagIds.length > 0 &&
        !(tagsByChapterId.get(chapter.id) ?? []).some((tag) => activeTagIds.includes(tag.id)) &&
        !chapterScenes.some((scene) =>
          (tagsBySceneId.get(scene.id) ?? []).some((tag) => activeTagIds.includes(tag.id)),
        )
      ) {
        return false;
      }
      if (!query) return true;
      const chapterMatches = [chapter.name, chapter.summary, chapter.extraNotes].some((value) =>
        value?.toLocaleLowerCase().includes(query),
      );
      return (
        chapterMatches ||
        chapterScenes.some((scene) => matchesSceneQuery(scene, query)) ||
        choices.some(
          (choice) =>
            matchesChoiceQuery(choice, query) &&
            chapterScenes.some((scene) => scene.id === choice.sceneId),
        )
      );
    });
    const direction = sortDirection === 'desc' ? -1 : 1;
    const sorted = [...filtered]
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
        isFavorite: chapter.isFavorite,
      }));

    const unchapteredScenes = scenesWithFavoriteState.filter((scene) => !scene.chapterId);
    const unchapteredHasFavorite = unchapteredScenes.some((scene) => scene.isFavorite);
    const unchapteredPassesFavorite =
      favoriteFilterState === 'all' ||
      (favoriteFilterState === 'favorite' && unchapteredHasFavorite) ||
      (favoriteFilterState === 'not-favorite' && !unchapteredHasFavorite);
    const unchapteredPassesAdvanced =
      !advancedMatches || unchapteredScenes.some((scene) => advancedMatches.sceneIds.has(scene.id));
    const unchapteredPassesTags =
      activeTagIds.length === 0 ||
      unchapteredScenes.some((scene) =>
        (tagsBySceneId.get(scene.id) ?? []).some((tag) => activeTagIds.includes(tag.id)),
      );
    const unchapteredPassesQuery =
      !query || unchapteredScenes.some((scene) => matchesSceneQuery(scene, query));
    const showEmptyUnchaptered =
      canEdit &&
      !query &&
      !advancedMatches &&
      activeTagIds.length === 0 &&
      favoriteFilterState === 'all';
    if (
      (unchapteredScenes.length > 0 &&
        unchapteredPassesFavorite &&
        unchapteredPassesAdvanced &&
        unchapteredPassesTags &&
        unchapteredPassesQuery) ||
      (showEmptyUnchaptered && unchapteredScenes.length === 0 && storyId)
    ) {
      sorted.push({
        id: UNCHAPTERED_GROUP_ID,
        storyId: unchapteredScenes[0]?.storyId ?? storyId ?? '',
        name: t('unchaptered_scenes'),
        index: Number.MAX_SAFE_INTEGER,
        type: 'chapter',
        summary: null,
        extraNotes: null,
        isFavorite: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      });
    }
    return sorted;
  }, [
    activeSort,
    activeTagIds,
    advancedMatches,
    choices,
    favoriteFilterState,
    outlineChapters,
    scenesWithFavoriteState,
    searchQuery,
    sortDirection,
    tagsByChapterId,
    tagsBySceneId,
    t,
    canEdit,
    storyId,
  ]);

  const memoizedChapterListItem = useCallback(
    ({ item }: { item: ChapterSelect }) => {
      const query = searchQuery.trim().toLocaleLowerCase();
      const allChapterScenes = scenesWithFavoriteState.filter((scene) =>
        sceneBelongsToGroup(scene, item.id),
      );
      const queryScenes = scenesShownForChapter(item.id, scenesWithFavoriteState, query);
      const choiceMatchedSceneIds = new Set(
        choices
          .filter((choice) => matchesChoiceQuery(choice, query))
          .map((choice) => choice.sceneId),
      );
      const chapterHasMatchingTag = (tagsByChapterId.get(item.id) ?? []).some((tag) =>
        activeTagIds.includes(tag.id),
      );
      const filteredByTag =
        activeTagIds.length > 0 && !chapterHasMatchingTag
          ? queryScenes.filter((scene) =>
              (tagsBySceneId.get(scene.id) ?? []).some((tag) => activeTagIds.includes(tag.id)),
            )
          : queryScenes;
      const filteredByFavorite =
        favoriteFilterState === 'favorite' && !item.isFavorite
          ? filteredByTag.filter((scene) => scene.isFavorite)
          : filteredByTag;
      const chapterScenes = advancedMatches
        ? filteredByFavorite.filter(
            (scene) =>
              advancedMatches.sceneIds.has(scene.id) &&
              advancedMatches.choiceSourceSceneIds.has(scene.id),
          )
        : query &&
            choiceMatchedSceneIds.size > 0 &&
            !queryScenes.some((scene) => matchesSceneQuery(scene, query))
          ? filteredByFavorite.filter((scene) => choiceMatchedSceneIds.has(scene.id))
          : filteredByFavorite;
      const hasSceneMatch = query
        ? scenesWithFavoriteState.some(
            (scene) => sceneBelongsToGroup(scene, item.id) && matchesSceneQuery(scene, query),
          ) || choiceMatchedSceneIds.size > 0
        : chapterScenes.length !== allChapterScenes.length;

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
              unchaptered={isUnchapteredGroup(item.id)}
              sortBy={activeSort}
              sortDirection={sortDirection}
              expandedSceneIds={expandedSceneIds}
              onSceneExpandedChange={onSceneExpandedChange}
              tagsBySceneId={tagsBySceneId}
            />
          )}
        />
      );
    },
    [
      canEdit,
      advancedMatches,
      activeTagIds,
      choices,
      favoriteFilterState,
      handleAddScene,
      handleOpenScene,
      handleToggleFavorite,
      handleToggleSceneFavorite,
      handleViewDetails,
      activeSort,
      sortDirection,
      scenesWithFavoriteState,
      selectedStory,
      searchQuery,
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

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 15,
      gap: 15,
    },
    headerButton: {},
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('narrative_elements_title'));
      navigation.getParent()?.setOptions({
        title: t('narrative_elements_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {selectedStory && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ChoiceView')}
                style={styles.headerButton}
                accessibilityLabel={
                  selectedStory.type === 'linear' ? t('story_flow_title') : t('story_map_title')
                }
              >
                <Ionicons name="git-network-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            )}
            {selectedStory?.type === 'linear' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('StoryTimeline')}
                style={styles.headerButton}
                accessibilityLabel={t('story_timeline_title')}
              >
                <Ionicons name="bar-chart-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity onPress={handleReorderPress} style={styles.headerButton}>
                <Ionicons name="swap-vertical" size={26} color={colors.text} />
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
      selectedStory,
    ]),
  );

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
      <GenericFilterSortList
        data={visibleChapters}
        renderItem={memoizedChapterListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('chapter_outline_search_placeholder', {
          chapters: term('Chapter', true),
          scenes: term('Scene', true),
        })}
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
        advancedSearchScopes={advancedSearchScopes}
        isLoading={loading}
        resultsMeta={t(
          visibleSceneCount === 1
            ? 'chapter_outline_scene_count_one'
            : 'chapter_outline_scene_count_other',
          { count: visibleSceneCount },
        )}
      />
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
