const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: jest.fn(),
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
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryNavigatorData } from '../../src/hooks/useStoryNavigatorData';
import { createChoiceCheckGroupService } from '../../src/services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../src/services/storymanagement/ChoiceCheckService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createEffectService } from '../../src/services/storymanagement/EffectService';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const sceneService = { getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'scene' }]) };

beforeEach(() => {
  jest.clearAllMocks();
  sceneService.getAllByStoryId.mockResolvedValue([{ id: 'scene' }]);
  (createSceneService as jest.Mock).mockReturnValue(sceneService);
  (createChoiceService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'choice' }]),
  });
  (createItemService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'item' }]),
  });
  (createChoiceCheckGroupService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'group' }]),
  });
  (createChoiceCheckService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'check' }]),
  });
  (createEffectService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'effect' }]),
  });
});

describe('useStoryNavigatorData', () => {
  it('loads one coherent read model for the branching navigator', async () => {
    const view = await renderHook(() => useStoryNavigatorData('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      scenes: [{ id: 'scene' }],
      choices: [{ id: 'choice' }],
      items: [{ id: 'item' }],
      groups: [{ id: 'group' }],
      checks: [{ id: 'check' }],
      effects: [{ id: 'effect' }],
    });
  });

  it('refreshes after graph changes and clears when there is no story', async () => {
    const view = await renderHook<
      ReturnType<typeof useStoryNavigatorData>,
      { storyId: string | undefined }
    >(({ storyId }) => useStoryNavigatorData(storyId), { initialProps: { storyId: 'story' } });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => entityEventEmitter.emit('choice_check_changed', 'story'));
    await waitFor(() => expect(sceneService.getAllByStoryId).toHaveBeenCalledTimes(2));

    await act(async () => view.rerender({ storyId: undefined }));
    expect(view.result.current).toMatchObject({
      scenes: [],
      choices: [],
      items: [],
      loading: false,
    });
  });

  it('fails closed when one dependency cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    sceneService.getAllByStoryId.mockRejectedValueOnce(new Error('database unavailable'));
    const view = await renderHook(() => useStoryNavigatorData('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load story navigator data:',
      expect.any(Error),
    );
    expect(view.result.current.scenes).toEqual([]);
  });
});
