jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/EffectService', () => ({
  __esModule: true,
  createEffectService: jest.fn(),
}));
jest.mock('../../src/state/characterStore', () => ({
  __esModule: true,
  useCharacterStore: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createCharacterSceneService } from '../../src/services/storymanagement/CharacterSceneService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { createItemJourneyService } from '../../src/services/storymanagement/ItemJourneyService';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { useCharacterStore } from '../../src/state/characterStore';
import { useSceneDetailServices } from '../../src/screens/narrative-elements/scenes/useSceneDetailServices';

const serviceFactories = [
  createSceneService,
  createChapterService,
  createChoiceService,
  createCharacterSceneService,
  createLocationService,
  createItemService,
  createItemJourneyService,
  createEffectService,
];

describe('useSceneDetailServices', () => {
  const db = { name: 'scene-detail-db' };
  const characters = [{ id: 'character-1', name: 'Hero' }];
  const fetchCharacters = jest.fn();
  const setDbAndStoryId = jest.fn();
  const initializeService = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCharacterStore as unknown as jest.Mock).mockReturnValue({
      characters,
      fetchCharacters,
      setDbAndStoryId,
      initializeService,
    });
    serviceFactories.forEach((factory, index) => {
      (factory as jest.Mock).mockReturnValue({ name: `service-${index}` });
    });
  });

  it('does not initialize services or the character store before a database is ready', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(null);

    await renderHook(() => useSceneDetailServices('story-1'));

    serviceFactories.forEach((factory) => expect(factory).not.toHaveBeenCalled());
    expect(setDbAndStoryId).not.toHaveBeenCalled();
    expect(initializeService).not.toHaveBeenCalled();
    expect(fetchCharacters).not.toHaveBeenCalled();
  });

  it('creates all services and loads the story-scoped character cache', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(db);

    const { result } = await renderHook(() => useSceneDetailServices('story-1'));

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledWith(db));
    expect(result.current.characters).toBe(characters);
    expect(result.current.sceneServiceRef.current).toEqual({ name: 'service-0' });
    expect(result.current.effectServiceRef.current).toEqual({ name: 'service-7' });
    expect(setDbAndStoryId).toHaveBeenCalledWith(db, 'story-1');
    expect(initializeService).toHaveBeenCalledTimes(1);
    expect(fetchCharacters).toHaveBeenCalledTimes(1);
  });

  it('creates services without touching the character cache when no story is selected', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(db);

    await renderHook(() => useSceneDetailServices());

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledWith(db));
    expect(setDbAndStoryId).not.toHaveBeenCalled();
    expect(initializeService).not.toHaveBeenCalled();
    expect(fetchCharacters).not.toHaveBeenCalled();
  });

  it('reuses services while refreshing characters for a different story', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(db);

    const view = await renderHook<ReturnType<typeof useSceneDetailServices>, { storyId: string }>(
      ({ storyId }) => useSceneDetailServices(storyId),
      { initialProps: { storyId: 'story-1' } },
    );
    await view.rerender({ storyId: 'story-2' });

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledTimes(1));
    expect(setDbAndStoryId).toHaveBeenNthCalledWith(1, db, 'story-1');
    expect(setDbAndStoryId).toHaveBeenNthCalledWith(2, db, 'story-2');
    expect(initializeService).toHaveBeenCalledTimes(2);
    expect(fetchCharacters).toHaveBeenCalledTimes(2);
  });

  it('initializes services and the cache after the database becomes available', async () => {
    let currentDb: typeof db | null = null;
    (useDrizzle as jest.Mock).mockImplementation(() => currentDb);
    const view = await renderHook(() => useSceneDetailServices('story-1'));

    currentDb = db;
    await view.rerender(undefined);

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledWith(db));
    expect(setDbAndStoryId).toHaveBeenCalledWith(db, 'story-1');
    expect(initializeService).toHaveBeenCalledTimes(1);
    expect(fetchCharacters).toHaveBeenCalledTimes(1);
  });
});
