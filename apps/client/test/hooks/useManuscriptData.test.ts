/** @jest-environment node */
import { renderHook, waitFor } from '@testing-library/react-native';
import { useManuscriptData } from '../../src/hooks/useManuscriptData';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const mockGetChapters = jest.fn();
const mockGetScenes = jest.fn();
const mockGetRoutes = jest.fn();
const mockGetChoices = jest.fn();
const mockGetSteps = jest.fn();

jest.mock('../../src/db', () => {
  const db = {};
  return {
    __esModule: true,
    useDrizzle: () => db,
  };
});

jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({ getAllByStoryId: mockGetChapters }),
}));

jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getAllByStoryId: mockGetScenes }),
}));

jest.mock('../../src/services/storymanagement/RouteService', () => ({
  __esModule: true,
  createRouteService: () => ({ getAllByStoryId: mockGetRoutes, getSteps: mockGetSteps }),
}));

jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: () => ({ getAllByStoryId: mockGetChoices }),
}));

jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetChapters.mockResolvedValue([{ id: 'ch-1' }]);
  mockGetScenes.mockResolvedValue([{ id: 'scene-1' }]);
  mockGetRoutes.mockResolvedValue([{ id: 'route-1' }]);
  mockGetChoices.mockResolvedValue([{ id: 'choice-1' }]);
  mockGetSteps.mockResolvedValue([{ id: 'step-1' }]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useManuscriptData', () => {
  it('loads every container, scene, route and step map', async () => {
    const view = await renderHook(() => useManuscriptData('story-1'));

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(mockGetChapters).toHaveBeenCalledWith('story-1', null);
    expect(mockGetScenes).toHaveBeenCalledWith('story-1');
    expect(mockGetSteps).toHaveBeenCalledWith('route-1');
    expect(view.result.current.chapters).toEqual([{ id: 'ch-1' }]);
    expect(view.result.current.scenes).toEqual([{ id: 'scene-1' }]);
    expect(view.result.current.routes).toEqual([{ id: 'route-1' }]);
    expect(view.result.current.choices).toEqual([{ id: 'choice-1' }]);
    expect(view.result.current.stepsByRouteId.get('route-1')).toEqual([{ id: 'step-1' }]);
  });

  it('returns empties without a story', async () => {
    const view = await renderHook(() => useManuscriptData(undefined));

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(mockGetScenes).not.toHaveBeenCalled();
    expect(view.result.current.scenes).toEqual([]);
    expect(view.result.current.stepsByRouteId.size).toBe(0);
  });

  it('reloads when a scene changes', async () => {
    const view = await renderHook(() => useManuscriptData('story-1'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(mockGetScenes).toHaveBeenCalledTimes(1);

    entityEventEmitter.emit('scene_changed', 'story-1', 'scene-1');

    await waitFor(() => expect(mockGetScenes).toHaveBeenCalledTimes(2));
  });

  it('empties on load failure instead of throwing', async () => {
    mockGetScenes.mockRejectedValue(new Error('db down'));
    const view = await renderHook(() => useManuscriptData('story-1'));

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.scenes).toEqual([]);
  });
});
