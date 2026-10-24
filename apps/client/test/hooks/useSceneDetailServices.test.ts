import { renderHook } from '@testing-library/react-native';
import { useDrizzle } from '@/src/db';
import { createChapterService } from '@/src/services/storymanagement/scenes-chapters/ChapterService';
import { createCharacterSceneService } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { createChoiceService } from '@/src/services/storymanagement/choices-stats/ChoiceService';
import { createEffectService } from '@/src/services/storymanagement/choices-stats/EffectService';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createSceneService } from '@/src/services/storymanagement/scenes-chapters/SceneService';
import { useCharacterStore } from '@/src/state/story/characterStore';
import { useSceneDetailServices } from '@/src/screens/narrative-elements/scenes/useSceneDetailServices';

jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('@/src/services/storymanagement/scenes-chapters/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/scenes-chapters/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/choices-stats/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/entities/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/entities/LocationService', () => ({
  __esModule: true,
  createLocationService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/entities/ItemService', () => ({
  __esModule: true,
  createItemService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/entities/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: jest.fn(),
}));
jest.mock('@/src/services/storymanagement/choices-stats/EffectService', () => ({
  __esModule: true,
  createEffectService: jest.fn(),
}));
jest.mock('@/src/state/story/characterStore', () => ({
  __esModule: true,
  useCharacterStore: jest.fn(),
}));

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
    (useDrizzle as jest.Mock).mockReturnValue(db);
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

  it('has every service ready on the first render and loads the story-scoped character cache', async () => {
    const { result } = await renderHook(() => useSceneDetailServices('story-1'));

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledWith(db));
    expect(result.current.characters).toBe(characters);
    expect(result.current.sceneService).toEqual({ name: 'service-0' });
    expect(result.current.effectService).toEqual({ name: 'service-7' });
    expect(setDbAndStoryId).toHaveBeenCalledWith(db, 'story-1');
    expect(initializeService).toHaveBeenCalledTimes(1);
    expect(fetchCharacters).toHaveBeenCalledTimes(1);
  });

  it('creates services without touching the character cache when no story is selected', async () => {
    await renderHook(() => useSceneDetailServices());

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledWith(db));
    expect(setDbAndStoryId).not.toHaveBeenCalled();
    expect(initializeService).not.toHaveBeenCalled();
    expect(fetchCharacters).not.toHaveBeenCalled();
  });

  it('reuses services while refreshing characters for a different story', async () => {
    const view = await renderHook<ReturnType<typeof useSceneDetailServices>, { storyId: string }>(
      ({ storyId }) => useSceneDetailServices(storyId),
      { initialProps: { storyId: 'story-1' } },
    );
    const firstServices = view.result.current.sceneService;
    await view.rerender({ storyId: 'story-2' });

    serviceFactories.forEach((factory) => expect(factory).toHaveBeenCalledTimes(1));
    expect(view.result.current.sceneService).toBe(firstServices);
    expect(setDbAndStoryId).toHaveBeenNthCalledWith(1, db, 'story-1');
    expect(setDbAndStoryId).toHaveBeenNthCalledWith(2, db, 'story-2');
    expect(initializeService).toHaveBeenCalledTimes(2);
    expect(fetchCharacters).toHaveBeenCalledTimes(2);
  });
});
