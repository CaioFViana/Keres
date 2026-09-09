import ChapterScenesList from '@/src/components/features/chapters/ChapterScenesList';
import ChapterListItem from '@/src/components/features/list-items/ChapterListItem';
import type { ChapterSelect, ChoiceSelect, SceneSelect, TagSelect } from '../../../db/schema';
import { isUnchapteredGroup } from '../../../utils/narrativeSceneOrder';

export type AdvancedNarrativeMatches = {
  chapterIds: ReadonlySet<string>;
  sceneIds: ReadonlySet<string>;
  choiceSourceSceneIds: ReadonlySet<string>;
};

export const matchesSceneQuery = (scene: SceneSelect, query: string) =>
  [scene.name, scene.summary, scene.extraNotes].some((value) =>
    value?.toLocaleLowerCase().includes(query),
  );

export const matchesChoiceQuery = (choice: ChoiceSelect, query: string) =>
  [choice.text, choice.notes].some((value) => value?.toLocaleLowerCase().includes(query));

export const sceneBelongsToGroup = (scene: SceneSelect, groupId: string) =>
  isUnchapteredGroup(groupId) ? !scene.chapterId : scene.chapterId === groupId;

export const scenesShownForChapter = (
  chapterId: string,
  allScenes: SceneSelect[],
  query: string,
) => {
  const chapterScenes = allScenes.filter((scene) => sceneBelongsToGroup(scene, chapterId));
  if (!query) return chapterScenes;
  const matchingScenes = chapterScenes.filter((scene) => matchesSceneQuery(scene, query));
  return matchingScenes.length > 0 ? matchingScenes : chapterScenes;
};

export type ChapterListItemRendererProps = {
  activeSort: string | null;
  activeTagIds: string[];
  advancedMatches: AdvancedNarrativeMatches | null | undefined;
  canEdit: boolean;
  choices: ChoiceSelect[];
  favoriteFilterState: string;
  handleAddScene: (chapterId: string) => void;
  handleOpenScene: (sceneId: string) => void;
  handleToggleFavorite: (chapterId: string, isFavorite: boolean) => void | Promise<void>;
  handleToggleSceneFavorite: (sceneId: string, isFavorite: boolean) => void | Promise<void>;
  handleViewDetails: (chapterId: string) => void;
  scenesWithFavoriteState: Array<SceneSelect & { isFavorite?: boolean }>;
  searchQuery: string;
  selectedStory: { type?: 'linear' | 'branching' | null } | null | undefined;
  sortDirection: 'asc' | 'desc' | string;
  tagsByChapterId: Map<string, TagSelect[]>;
  tagsBySceneId: Map<string, TagSelect[]>;
  setReorderChapterId: (chapterId: string | null) => void;
};

// `activeSort` stays a plain string: the list screen owns the sort vocabulary.

export const createChapterListItemRenderer = (props: ChapterListItemRendererProps) => {
  const {
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
  } = props;

  return function ChapterListItemRenderer({ item }: { item: ChapterSelect }) {
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

    const storyType =
      selectedStory?.type === 'linear' || selectedStory?.type === 'branching'
        ? selectedStory.type
        : undefined;
    const direction = sortDirection === 'desc' ? 'desc' : 'asc';

    return (
      <ChapterListItem
        chapter={item}
        onViewDetails={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
        initialExpanded={hasSceneMatch}
        tags={tagsByChapterId.get(item.id)}
        renderScenes={({ expandedSceneIds, onSceneExpandedChange }) => (
          <ChapterScenesList
            storyType={storyType}
            scenes={chapterScenes}
            allChapterScenes={allChapterScenes}
            choices={choices}
            canEdit={canEdit}
            onOpenScene={handleOpenScene}
            onToggleFavorite={handleToggleSceneFavorite}
            onAddScene={() => handleAddScene(item.id)}
            onReorderScenes={() => props.setReorderChapterId(item.id)}
            unchaptered={isUnchapteredGroup(item.id)}
            sortBy={activeSort}
            sortDirection={direction}
            expandedSceneIds={expandedSceneIds}
            onSceneExpandedChange={onSceneExpandedChange}
            tagsBySceneId={tagsBySceneId}
          />
        )}
      />
    );
  };
};
