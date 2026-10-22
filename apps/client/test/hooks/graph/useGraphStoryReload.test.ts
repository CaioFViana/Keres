/**
 * @jest-environment node
 */
import { act, renderHook } from '@testing-library/react-native';
import { useGraphStoryReload } from '@/src/hooks/graph/useGraphStoryReload';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { logger } from '@/src/utils/logging/logger';

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

describe('useGraphStoryReload', () => {
  it('reloads on focus and when the story changes elsewhere, and only for its own story', async () => {
    const loadGraph = jest.fn().mockResolvedValue(undefined);
    await renderHook(() => useGraphStoryReload('story-1', loadGraph));
    expect(loadGraph).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('story_data_changed', { storyId: 'story-2' } as never);
    });
    expect(loadGraph).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('story_data_changed', { storyId: 'story-1' } as never);
    });
    expect(loadGraph).toHaveBeenCalledTimes(2);
  });

  it('logs a reload that fails instead of losing the rejection', async () => {
    const failure = new Error('db down');
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const loadGraph = jest.fn().mockRejectedValue(failure);

    await renderHook(() => useGraphStoryReload('story-1', loadGraph));
    await act(async () => {});

    expect(logged).toHaveBeenCalledWith('The graph reload failed:', failure);
    logged.mockRestore();
  });
});
