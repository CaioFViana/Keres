const mockUseDrizzle = jest.fn();
const mockCreateSceneService = jest.fn();
const mockFetchChapters = jest.fn();
const mockSetChapterDb = jest.fn();
const mockInitChapter = jest.fn();
const mockFetchLocations = jest.fn();
const mockSetLocationDb = jest.fn();
const mockInitLocation = jest.fn();
const mockFetchCharacters = jest.fn();
const mockSetCharacterDb = jest.fn();
const mockInitCharacter = jest.fn();
const mockFetchItems = jest.fn();
const mockSetItemDb = jest.fn();
const mockInitItem = jest.fn();

jest.mock('../../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  createSceneService: (...args: unknown[]) => mockCreateSceneService(...args),
}));
jest.mock('../../../../src/state/chapterStore', () => ({
  useChapterStore: () => ({
    chapters: [{ id: 'chapter-1' }],
    fetchChapters: mockFetchChapters,
    setDbAndStoryId: mockSetChapterDb,
    initializeService: mockInitChapter,
  }),
}));
jest.mock('../../../../src/state/locationStore', () => ({
  useLocationStore: () => ({
    locations: [{ id: 'location-1' }],
    fetchLocations: mockFetchLocations,
    setDbAndStoryId: mockSetLocationDb,
    initializeService: mockInitLocation,
  }),
}));
jest.mock('../../../../src/state/characterStore', () => ({
  useCharacterStore: () => ({
    characters: [{ id: 'character-1' }],
    fetchCharacters: mockFetchCharacters,
    setDbAndStoryId: mockSetCharacterDb,
    initializeService: mockInitCharacter,
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
import { useSceneFormResources } from '../../../../src/screens/narrative-elements/scenes/useSceneFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'scene-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateSceneService.mockReturnValue(fakeService);
});

it('creates the scene service and wires every lookup store to the story', async () => {
  const view = await renderHook(() => useSceneFormResources('story-1'));

  expect(mockCreateSceneService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.sceneServiceRef.current).toBe(fakeService);
  for (const [setDb, init, fetch] of [
    [mockSetChapterDb, mockInitChapter, mockFetchChapters],
    [mockSetLocationDb, mockInitLocation, mockFetchLocations],
    [mockSetCharacterDb, mockInitCharacter, mockFetchCharacters],
    [mockSetItemDb, mockInitItem, mockFetchItems],
  ]) {
    expect(setDb).toHaveBeenCalledWith(fakeDb, 'story-1');
    expect(init).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
  }
  expect(view.result.current.chapters).toEqual([{ id: 'chapter-1' }]);
  expect(view.result.current.locations).toEqual([{ id: 'location-1' }]);
  expect(view.result.current.characters).toEqual([{ id: 'character-1' }]);
  expect(view.result.current.items).toEqual([{ id: 'item-1' }]);
});

it('still creates the service when no story is selected, without store wiring', async () => {
  const view = await renderHook(() => useSceneFormResources(undefined));

  expect(mockCreateSceneService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.sceneServiceRef.current).toBe(fakeService);
  expect(mockSetChapterDb).not.toHaveBeenCalled();
  expect(mockFetchChapters).not.toHaveBeenCalled();
  expect(mockFetchLocations).not.toHaveBeenCalled();
  expect(mockFetchCharacters).not.toHaveBeenCalled();
  expect(mockFetchItems).not.toHaveBeenCalled();
});
