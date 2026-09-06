jest.mock('../../../../src/components/features/chapters/ChapterScenesList', () => ({
  __esModule: true,
  default: 'ChapterScenesList',
}));
jest.mock('../../../../src/components/features/list-items/ChapterListItem', () => ({
  __esModule: true,
  default: 'ChapterListItem',
}));

import {
  createChapterListItemRenderer,
  matchesChoiceQuery,
  matchesSceneQuery,
  sceneBelongsToGroup,
  scenesShownForChapter,
} from '../../../../src/screens/narrative-elements/chapters/createChapterListItemRenderer';
import { UNCHAPTERED_GROUP_ID } from '../../../../src/utils/narrativeSceneOrder';

const scene = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'scene-1',
    chapterId: 'chapter-1',
    name: 'The Hidden Door',
    summary: 'A clue appears in the library.',
    extraNotes: 'Only opens at dawn.',
    ...overrides,
  }) as any;

describe('chapter list query helpers', () => {
  it('matches scene names, summaries and notes without case sensitivity', () => {
    expect(matchesSceneQuery(scene(), 'hidden')).toBe(true);
    expect(matchesSceneQuery(scene(), 'library')).toBe(true);
    expect(matchesSceneQuery(scene(), 'dawn')).toBe(true);
    expect(matchesSceneQuery(scene(), 'castle')).toBe(false);
  });

  it('matches choice text and notes without requiring both', () => {
    expect(matchesChoiceQuery({ text: 'Open the door', notes: null } as any, 'door')).toBe(true);
    expect(matchesChoiceQuery({ text: null, notes: 'Requires a key' } as any, 'key')).toBe(true);
    expect(matchesChoiceQuery({ text: 'Wait', notes: null } as any, 'key')).toBe(false);
  });

  it('keeps unchaptered scenes separate from chapter-owned scenes', () => {
    expect(sceneBelongsToGroup(scene(), 'chapter-1')).toBe(true);
    expect(sceneBelongsToGroup(scene(), 'chapter-2')).toBe(false);
    expect(sceneBelongsToGroup(scene({ chapterId: null }), UNCHAPTERED_GROUP_ID)).toBe(true);
    expect(sceneBelongsToGroup(scene(), UNCHAPTERED_GROUP_ID)).toBe(false);
  });

  it('shows all chapter scenes when a query has no scene match', () => {
    const chapterScenes = [scene(), scene({ id: 'scene-2', name: 'The Bridge' })];

    expect(scenesShownForChapter('chapter-1', chapterScenes, 'missing')).toEqual(chapterScenes);
  });

  it('narrows a chapter to matching scenes when one exists', () => {
    const hiddenDoor = scene();
    const bridge = scene({ id: 'scene-2', name: 'The Bridge' });

    expect(scenesShownForChapter('chapter-1', [hiddenDoor, bridge], 'bridge')).toEqual([bridge]);
  });

  it('returns every scene in the requested chapter for an empty query', () => {
    const chapterScene = scene();
    const otherChapterScene = scene({ id: 'scene-2', chapterId: 'chapter-2' });

    expect(scenesShownForChapter('chapter-1', [chapterScene, otherChapterScene], '')).toEqual([
      chapterScene,
    ]);
  });

  it('does not let a match in another chapter affect the requested chapter', () => {
    const requestedChapterScene = scene({ name: 'The Bridge' });
    const otherChapterMatch = scene({ id: 'scene-2', chapterId: 'chapter-2', name: 'Hidden Door' });

    expect(
      scenesShownForChapter('chapter-1', [requestedChapterScene, otherChapterMatch], 'hidden'),
    ).toEqual([requestedChapterScene]);
  });

  it('passes filtered scenes and interaction callbacks to the chapter components', () => {
    const onAddScene = jest.fn();
    const onReorder = jest.fn();
    const chapter = { id: 'chapter-1', isFavorite: false } as any;
    const matchingScene = scene({ isFavorite: true });
    const renderer = createChapterListItemRenderer({
      activeSort: 'name',
      activeTagIds: [],
      advancedMatches: null,
      canEdit: true,
      choices: [],
      favoriteFilterState: 'all',
      handleAddScene: onAddScene,
      handleOpenScene: jest.fn(),
      handleToggleFavorite: jest.fn(),
      handleToggleSceneFavorite: jest.fn(),
      handleViewDetails: jest.fn(),
      scenesWithFavoriteState: [matchingScene],
      searchQuery: 'hidden',
      selectedStory: { type: 'branching' },
      setReorderChapterId: onReorder,
      sortDirection: 'asc',
      tagsByChapterId: new Map(),
      tagsBySceneId: new Map(),
    });

    const chapterItem = renderer({ item: chapter });
    const scenesList = chapterItem.props.renderScenes({
      expandedSceneIds: new Set(['scene-1']),
      onSceneExpandedChange: jest.fn(),
    });

    expect(chapterItem.props.initialExpanded).toBe(true);
    expect(scenesList.props.scenes).toEqual([matchingScene]);
    expect(scenesList.props.allChapterScenes).toEqual([matchingScene]);
    expect(scenesList.props.canEdit).toBe(true);
    scenesList.props.onAddScene();
    scenesList.props.onReorderScenes();
    expect(onAddScene).toHaveBeenCalledWith('chapter-1');
    expect(onReorder).toHaveBeenCalledWith('chapter-1');
  });

  it('applies advanced search matches to chapter scenes', () => {
    const matchingScene = scene({ id: 'matching' });
    const nonMatchingScene = scene({ id: 'other' });
    const renderer = createChapterListItemRenderer({
      activeSort: 'name',
      activeTagIds: [],
      advancedMatches: {
        sceneIds: new Set(['matching']),
        choiceSourceSceneIds: new Set(['matching']),
      },
      canEdit: true,
      choices: [],
      favoriteFilterState: 'all',
      handleAddScene: jest.fn(),
      handleOpenScene: jest.fn(),
      handleToggleFavorite: jest.fn(),
      handleToggleSceneFavorite: jest.fn(),
      handleViewDetails: jest.fn(),
      scenesWithFavoriteState: [matchingScene, nonMatchingScene],
      searchQuery: '',
      selectedStory: { type: 'linear' },
      setReorderChapterId: jest.fn(),
      sortDirection: 'asc',
      tagsByChapterId: new Map(),
      tagsBySceneId: new Map(),
    });

    const chapterItem = renderer({ item: { id: 'chapter-1', isFavorite: false } as any });
    const scenesList = chapterItem.props.renderScenes({
      expandedSceneIds: new Set(),
      onSceneExpandedChange: jest.fn(),
    });

    expect(scenesList.props.scenes).toEqual([matchingScene]);
  });
});
