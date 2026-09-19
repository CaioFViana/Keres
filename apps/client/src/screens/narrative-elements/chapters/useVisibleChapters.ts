import { useMemo } from 'react';
import type { ChapterSelect, ChoiceSelect, SceneSelect, TagSelect } from '../../../db/schema';
import type { FavoriteFilterState, SortDirection } from '../../../types/entityFilters';
import { UNCHAPTERED_GROUP_ID } from '../../../utils/narrativeSceneOrder';
import { chapterBelongsToArc } from '../../../utils/storyArcFilter';
import {
  type AdvancedNarrativeMatches,
  matchesChoiceQuery,
  matchesSceneQuery,
} from './createChapterListItemRenderer';

export interface VisibleChaptersInput {
  outlineChapters: ChapterSelect[];
  scenes: SceneSelect[];
  choices: ChoiceSelect[];
  tagsByChapterId: Map<string, TagSelect[]>;
  tagsBySceneId: Map<string, TagSelect[]>;
  activeTagIds: string[];
  advancedMatches: AdvancedNarrativeMatches | null;
  favoriteFilterState: FavoriteFilterState;
  activeArcId: string | null;
  searchQuery: string;
  activeSort: string | null;
  sortDirection: SortDirection;
  canEdit: boolean;
  storyId: string | undefined;
  t: (key: string) => string;
}

/**
 * The chapter outline as the list shows it: arc/tag/favorite/advanced/text filters, the
 * requested sort, and the synthetic "Unchaptered" group appended last. The empty drop target
 * only joins once chapters exist, so a truly empty story renders the guided empty state
 * instead of an empty group.
 */
export function useVisibleChapters(input: VisibleChaptersInput): ChapterSelect[] {
  const {
    outlineChapters,
    scenes,
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
  } = input;

  return useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filtered = outlineChapters.filter((chapter) => {
      if (!chapterBelongsToArc(chapter, activeArcId)) return false;
      const chapterScenes = scenes.filter((scene) => scene.chapterId === chapter.id);
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

    const unchapteredScenes = scenes.filter((scene) => !scene.chapterId);
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
      // The empty drop target only makes sense once chapters exist: on a truly empty
      // story it would hide the guided empty state behind an empty "Unchaptered" group.
      (showEmptyUnchaptered &&
        unchapteredScenes.length === 0 &&
        storyId &&
        outlineChapters.length > 0)
    ) {
      sorted.push({
        id: UNCHAPTERED_GROUP_ID,
        storyId: unchapteredScenes[0]?.storyId ?? storyId ?? '',
        name: t('unchaptered_scenes'),
        index: Number.MAX_SAFE_INTEGER,
        type: 'chapter',
        summary: null,
        extraNotes: null,
        arcId: null,
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
    activeArcId,
    outlineChapters,
    scenes,
    searchQuery,
    sortDirection,
    tagsByChapterId,
    tagsBySceneId,
    t,
    canEdit,
    storyId,
  ]);
}
