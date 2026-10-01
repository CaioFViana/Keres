const mockUseDrizzle = jest.fn();
const mockCreateChoiceService = jest.fn();
const mockFetchScenes = jest.fn();
const mockSetSceneDb = jest.fn();
const mockInitScene = jest.fn();
const mockFetchItems = jest.fn();
const mockSetItemDb = jest.fn();
const mockInitItem = jest.fn();

jest.mock('../../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../../src/services/storymanagement/ChoiceService', () => ({
  createChoiceService: (...args: unknown[]) => mockCreateChoiceService(...args),
}));
jest.mock('../../../../src/state/sceneStore', () => ({
  useSceneStore: () => ({
    scenes: [{ id: 'scene-1' }],
    fetchScenes: mockFetchScenes,
    setDbAndStoryId: mockSetSceneDb,
    initializeService: mockInitScene,
  }),
}));
jest.mock('../../../../src/state/itemStore', () => ({
  useItemStore: () => ({
    items: [{ id: 'item-1' }],
    fetchItems: mockFetchItems,
    setDbAndStoryId: mockSetItemDb,
    initializeService: mockInitItem,
  }),
}));

import { renderHook } from '@testing-library/react-native';
import { useChoiceFormResources } from '../../../../src/screens/narrative-elements/choices/useChoiceFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'choice-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateChoiceService.mockReturnValue(fakeService);
});

it('creates the choice service and wires the lookup stores to the story', async () => {
  const view = await renderHook(() => useChoiceFormResources('story-1'));

  expect(mockCreateChoiceService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.choiceServiceRef.current).toBe(fakeService);
  expect(mockSetSceneDb).toHaveBeenCalledWith(fakeDb, 'story-1');
  expect(mockInitScene).toHaveBeenCalled();
  expect(mockFetchScenes).toHaveBeenCalled();
  expect(mockSetItemDb).toHaveBeenCalledWith(fakeDb, 'story-1');
  expect(mockInitItem).toHaveBeenCalled();
  expect(mockFetchItems).toHaveBeenCalled();
  expect(view.result.current.scenes).toEqual([{ id: 'scene-1' }]);
  expect(view.result.current.items).toEqual([{ id: 'item-1' }]);
});

it('still creates the service when no story is selected, without store wiring', async () => {
  const view = await renderHook(() => useChoiceFormResources(undefined));

  expect(mockCreateChoiceService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.choiceServiceRef.current).toBe(fakeService);
  expect(mockSetSceneDb).not.toHaveBeenCalled();
  expect(mockFetchScenes).not.toHaveBeenCalled();
  expect(mockSetItemDb).not.toHaveBeenCalled();
  expect(mockFetchItems).not.toHaveBeenCalled();
});
