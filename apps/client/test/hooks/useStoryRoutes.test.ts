const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/RouteService', () => ({
  __esModule: true,
  createRouteService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceCheckGroupService', () => ({
  __esModule: true,
  createChoiceCheckGroupService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceCheckService', () => ({
  __esModule: true,
  createChoiceCheckService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/EffectService', () => ({
  __esModule: true,
  createEffectService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createChoiceCheckGroupService } from '../../src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../src/services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { createRouteService } from '../../src/services/storymanagement/RouteService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { useStoryRoutes } from '../../src/hooks/useStoryRoutes';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const route = { id: 'route', storyId: 'story', isDeleted: false } as never;
const sceneA = { id: 'scene-a', storyId: 'story', isDeleted: false } as never;
const sceneB = { id: 'scene-b', storyId: 'story', isDeleted: false } as never;
const choice = {
  id: 'choice',
  sceneId: 'scene-a',
  nextSceneId: 'scene-b',
  isDeleted: false,
} as never;
const steps = [
  {
    id: 'step-a',
    routeId: 'route',
    position: 1,
    sceneId: 'scene-a',
    selectedChoiceId: 'choice',
    isDeleted: false,
  },
  {
    id: 'step-b',
    routeId: 'route',
    position: 2,
    sceneId: 'scene-b',
    selectedChoiceId: null,
    isDeleted: false,
  },
] as never;

beforeEach(() => {
  jest.clearAllMocks();
  (createRouteService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([route]),
    getSteps: jest.fn().mockResolvedValue(steps),
  });
  (createSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([sceneA, sceneB]),
  });
  (createChoiceService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([choice]),
  });
  (createChapterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([]),
  });
  (createChoiceCheckGroupService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([]),
  });
  (createChoiceCheckService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([]),
  });
  (createEffectService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([]),
  });
});

describe('useStoryRoutes', () => {
  it('builds one coherent route read model and validates its selected choices', async () => {
    const view = await renderHook(() => useStoryRoutes('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.stepsOf('route')).toEqual(steps);
    expect(view.result.current.sceneById('scene-a')).toBe(sceneA);
    expect(view.result.current.choicesFrom('scene-a')).toEqual([choice]);
    expect(view.result.current.validationOf('route')).toEqual([]);
    expect(view.result.current.executionValidationOf('route')).toMatchObject({ valid: true });
  });

  it('reloads the route model after a graph change and unsubscribes on unmount', async () => {
    const view = await renderHook(() => useStoryRoutes('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const service = (createRouteService as jest.Mock).mock.results[0].value;
    await act(async () => {
      entityEventEmitter.emit('choice_changed', 'story');
    });
    await waitFor(() => expect(service.getAllByStoryId).toHaveBeenCalledTimes(2));
    await view.unmount();
    expect(() => entityEventEmitter.emit('route_step_changed', 'story')).not.toThrow();
  });
});
