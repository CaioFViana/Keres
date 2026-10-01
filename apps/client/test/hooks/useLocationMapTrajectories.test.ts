import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLocationMapTrajectories } from '../../src/hooks/useLocationMapTrajectories';

const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));

const scenes = [
  { id: 's-1', chapterId: 'ch-1', index: 1, locationId: 'loc-a', isDeleted: false },
  { id: 's-2', chapterId: 'ch-1', index: 2, locationId: 'loc-b', isDeleted: false },
  { id: 's-3', chapterId: 'ch-1', index: 3, locationId: 'loc-c', isDeleted: false },
];
const journeys = [
  { id: 'j-1', itemId: 'item-1', sceneId: 's-1', isDeleted: false },
  { id: 'j-2', itemId: 'item-1', sceneId: 's-3', isDeleted: false },
];
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  createSceneService: () => ({ getAllByStoryId: async () => scenes }),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  createChapterService: () => ({ getAllByStoryId: async () => [{ id: 'ch-1', index: 1 }] }),
}));
jest.mock('../../src/services/storymanagement/CharacterSceneService', () => ({
  createCharacterSceneService: () => ({
    getRelationsByStoryId: async () => [
      { characterId: 'char-1', sceneId: 's-1', isDeleted: false },
      { characterId: 'char-1', sceneId: 's-2', isDeleted: false },
      { characterId: 'char-1', sceneId: 's-3', isDeleted: false },
    ],
  }),
}));
jest.mock('../../src/services/storymanagement/ItemService', () => ({
  createItemService: () => ({
    getAllByStoryId: async () => [{ id: 'item-1', name: 'Sword', isDeleted: false }],
  }),
}));
jest.mock('../../src/services/storymanagement/ItemJourneyService', () => ({
  createItemJourneyService: () => ({ getAllByStoryId: async () => journeys }),
}));
jest.mock('../../src/services/storymanagement/CharacterService', () => ({
  createCharacterService: () => ({
    getAllByStoryId: async () => [{ id: 'char-1', name: 'Aragorn', isDeleted: false }],
  }),
}));
jest.mock('../../src/services/storymanagement/RouteService', () => ({
  createRouteService: () => ({ getAllByStoryId: async () => [], getSteps: async () => [] }),
}));

const NODES = [
  { id: 'n-1', locationId: 'loc-a', x: 10, y: 10 },
  { id: 'n-2', locationId: 'loc-b', x: 50, y: 50 },
];

describe('useLocationMapTrajectories', () => {
  it('projects selected entities onto the map points and counts the off-map rest', async () => {
    const view = await renderHook(() =>
      useLocationMapTrajectories({
        storyId: 'story-1',
        storyType: 'linear',
        nodes: NODES as never,
      }),
    );
    await waitFor(() => expect(view.result.current.characters).toHaveLength(1));
    expect(view.result.current.hasSelection).toBe(false);

    await act(async () => view.result.current.toggleCharacter('char-1'));
    expect(view.result.current.hasSelection).toBe(true);
    // loc-a and loc-b project; loc-c has no node on this map.
    expect(view.result.current.offMapCount).toBe(1);
    expect(view.result.current.overlays).toHaveLength(1);
    expect(view.result.current.overlays[0]).toMatchObject({
      kind: 'line',
      label: 'Aragorn',
      dashed: true,
      directed: true,
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
      ],
    });

    // The sword jumps from s-1 to s-3: one projected stop is no drawable path.
    await act(async () => view.result.current.toggleItem('item-1'));
    expect(view.result.current.overlays).toHaveLength(1);
    expect(view.result.current.offMapCount).toBe(2);

    await act(async () => view.result.current.clearSelection());
    expect(view.result.current.hasSelection).toBe(false);
    expect(view.result.current.overlays).toHaveLength(0);
    expect(view.result.current.offMapCount).toBe(0);
  });
});
