const mockDb = {};
const itemIds = ['item-1'];
const mockCharacterService = { getAllByStoryId: jest.fn() };
const mockSceneService = { getAllByStoryId: jest.fn() };
const mockChapterService = { getAllByStoryId: jest.fn() };
const mockCharacterSceneService = { getRelationsByStoryId: jest.fn() };
const mockItemService = { getAllByStoryId: jest.fn() };
const mockJourneyService = { getItemJourneysByItemId: jest.fn() };

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: jest.fn(() => mockCharacterService),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(() => mockSceneService),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(() => mockChapterService),
}));
jest.mock('../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: jest.fn(() => mockCharacterSceneService),
}));
jest.mock('../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: jest.fn(() => mockItemService),
}));
jest.mock('../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: jest.fn(() => mockJourneyService),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePresenceMatrixCatalog } from '../../src/hooks/usePresenceMatrixCatalog';

beforeEach(() => {
  jest.clearAllMocks();
  mockCharacterService.getAllByStoryId.mockResolvedValue([
    { id: 'character-1', isDeleted: false },
    { id: 'character-deleted', isDeleted: true },
  ]);
  mockSceneService.getAllByStoryId.mockResolvedValue([{ id: 'scene-1', isDeleted: false }]);
  mockChapterService.getAllByStoryId.mockResolvedValue([{ id: 'chapter-1', isDeleted: false }]);
  mockCharacterSceneService.getRelationsByStoryId.mockResolvedValue([
    { characterId: 'character-1', sceneId: 'scene-1', isDeleted: false },
  ]);
  mockItemService.getAllByStoryId.mockResolvedValue([
    { id: 'item-1', isDeleted: false },
    { id: 'item-deleted', isDeleted: true },
  ]);
  mockJourneyService.getItemJourneysByItemId.mockImplementation(
    async (_storyId: string, itemId: string) => [
      { id: `${itemId}-journey`, itemId, isDeleted: false },
      { id: `${itemId}-deleted`, itemId, isDeleted: true },
    ],
  );
});

describe('usePresenceMatrixCatalog', () => {
  it('loads and filters the catalog and requested item journeys', async () => {
    const view = await renderHook(() => usePresenceMatrixCatalog('story-1', itemIds, true));
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current).toMatchObject({
      characters: [{ id: 'character-1' }],
      scenes: [{ id: 'scene-1' }],
      chapters: [{ id: 'chapter-1' }],
      presence: [{ characterId: 'character-1', sceneId: 'scene-1' }],
      items: [{ id: 'item-1' }],
      journeys: [{ id: 'item-1-journey' }],
    });
    expect(mockChapterService.getAllByStoryId).toHaveBeenCalledWith('story-1', null);
  });

  it('clears optional journeys and can fetch every loaded item on demand', async () => {
    const view = await renderHook(() => usePresenceMatrixCatalog('story-1', itemIds, false));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.journeys).toEqual([]);

    await act(async () =>
      expect(await view.result.current.fetchAllItemJourneys()).toEqual([
        expect.objectContaining({ id: 'item-1-journey' }),
      ]),
    );
    expect(view.result.current.journeys).toEqual([
      expect.objectContaining({ id: 'item-1-journey' }),
    ]);
  });

  it('does not fetch data when no story is selected', async () => {
    const view = await renderHook(() => usePresenceMatrixCatalog(undefined, itemIds, true));
    await act(async () => expect(await view.result.current.fetchAllItemJourneys()).toEqual([]));
    expect(mockCharacterService.getAllByStoryId).not.toHaveBeenCalled();
    expect(mockJourneyService.getItemJourneysByItemId).not.toHaveBeenCalled();
  });
});
