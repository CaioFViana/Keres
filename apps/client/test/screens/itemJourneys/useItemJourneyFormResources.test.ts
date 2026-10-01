const mockDb = {};
const mockCreateItemJourneyService: jest.Mock = jest.fn(() => ({
  id: 'item-journey-service',
}));
const mockItemStore = {
  items: [{ id: 'item-1' }],
  fetchItems: jest.fn(),
  setDbAndStoryId: jest.fn(),
  initializeService: jest.fn(),
};
const mockSceneStore = {
  scenes: [{ id: 'scene-1' }],
  fetchScenes: jest.fn(),
  setDbAndStoryId: jest.fn(),
  initializeService: jest.fn(),
};
const mockCharacterStore = {
  characters: [{ id: 'character-1' }],
  fetchCharacters: jest.fn(),
  setDbAndStoryId: jest.fn(),
  initializeService: jest.fn(),
};

jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../../src/services/storymanagement/ItemJourneyService', () => ({
  createItemJourneyService: (...args: unknown[]) => mockCreateItemJourneyService(...args),
}));
jest.mock('../../../src/state/itemStore', () => ({ useItemStore: () => mockItemStore }));
jest.mock('../../../src/state/sceneStore', () => ({ useSceneStore: () => mockSceneStore }));
jest.mock('../../../src/state/characterStore', () => ({
  useCharacterStore: () => mockCharacterStore,
}));

import { renderHook } from '@testing-library/react-native';
import { useItemJourneyFormResources } from '../../../src/screens/itemJourneys/useItemJourneyFormResources';

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates the journey service and initializes the lookup stores for the story', async () => {
  const view = await renderHook(() => useItemJourneyFormResources('story-1'));

  expect(view.result.current.drizzleDb).toBe(mockDb);
  expect(mockCreateItemJourneyService).toHaveBeenCalledWith(mockDb);
  expect(view.result.current.itemJourneyServiceRef.current).toEqual({
    id: 'item-journey-service',
  });
  expect(mockItemStore.setDbAndStoryId).toHaveBeenCalledWith(mockDb, 'story-1');
  expect(mockItemStore.initializeService).toHaveBeenCalled();
  expect(mockItemStore.fetchItems).toHaveBeenCalled();
  expect(mockSceneStore.setDbAndStoryId).toHaveBeenCalledWith(mockDb, 'story-1');
  expect(mockSceneStore.fetchScenes).toHaveBeenCalled();
  expect(mockCharacterStore.setDbAndStoryId).toHaveBeenCalledWith(mockDb, 'story-1');
  expect(mockCharacterStore.fetchCharacters).toHaveBeenCalled();
  expect(view.result.current.items).toEqual([{ id: 'item-1' }]);
  expect(view.result.current.scenes).toEqual([{ id: 'scene-1' }]);
  expect(view.result.current.characters).toEqual([{ id: 'character-1' }]);
});

it('skips store initialization without a story', async () => {
  await renderHook(() => useItemJourneyFormResources(undefined));

  expect(mockItemStore.fetchItems).not.toHaveBeenCalled();
  expect(mockSceneStore.fetchScenes).not.toHaveBeenCalled();
  expect(mockCharacterStore.fetchCharacters).not.toHaveBeenCalled();
});
