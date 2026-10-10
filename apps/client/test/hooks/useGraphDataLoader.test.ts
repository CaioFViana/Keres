/**
 * @jest-environment node
 */
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useGraphDataLoader } from '../../src/hooks/useGraphDataLoader';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const ERROR = 'could not load';
const LOG = 'test: failed to load';

/** `null` renders without a story; leaving it out renders story-1. */
async function setup(initialStory: string | null = 'story-1') {
  const load = jest.fn<Promise<string>, [string]>().mockResolvedValue('first');
  const view = await renderHook(
    ({ storyId }: { storyId: string | undefined }) =>
      useGraphDataLoader({ storyId, load, errorMessage: ERROR, logMessage: LOG }),
    { initialProps: { storyId: initialStory ?? undefined } },
  );
  return { load, ...view };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useGraphDataLoader', () => {
  it('starts loading and hands over the data once it arrives', async () => {
    const { result } = await setup();

    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reports the failure of the first load and stops loading', async () => {
    // Stable, like the useCallback the screens pass: a new function each render would reload forever.
    const failing = async (): Promise<string> => {
      throw new Error('db down');
    };
    const view = await renderHook(() =>
      useGraphDataLoader({
        storyId: 'story-9',
        load: failing,
        errorMessage: ERROR,
        logMessage: LOG,
      }),
    );

    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.error).toBe(ERROR);
    expect(view.result.current.data).toBeNull();
  });

  it('does nothing without a story', async () => {
    const { load, result } = await setup(null);

    expect(load).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  describe('once a story is on screen', () => {
    const loaded = async () => {
      const setupResult = await setup();
      await waitFor(() => expect(setupResult.result.current.data).toBe('first'));
      return setupResult;
    };

    it('swaps in fresh data on a change of the story without going back to loading', async () => {
      const { load, result } = await loaded();
      load.mockResolvedValue('second');
      const seenLoading: boolean[] = [];

      await act(async () => {
        entityEventEmitter.emit('story_data_changed', { storyId: 'story-1' });
        seenLoading.push(result.current.loading);
      });

      await waitFor(() => expect(result.current.data).toBe('second'));
      expect(seenLoading).toEqual([false]);
      expect(result.current.loading).toBe(false);
    });

    it('keeps what is on screen, and says nothing, when a refresh fails', async () => {
      const { load, result } = await loaded();
      load.mockRejectedValue(new Error('offline'));

      await act(async () => {
        entityEventEmitter.emit('story_data_changed', { storyId: 'story-1' });
      });

      expect(result.current.data).toBe('first');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('ignores the changes of another story', async () => {
      const { load } = await loaded();
      const calls = load.mock.calls.length;

      await act(async () => {
        entityEventEmitter.emit('story_data_changed', { storyId: 'other' });
      });

      expect(load.mock.calls.length).toBe(calls);
    });

    it('goes back to loading when the story itself changes', async () => {
      const { load, result, rerender } = await loaded();
      let release: (value: string) => void = () => {};
      load.mockImplementation(() => new Promise<string>((resolve) => (release = resolve)));

      await act(async () => {
        rerender({ storyId: 'story-2' });
      });

      expect(result.current.loading).toBe(true);
      await act(async () => release('story two'));
      await waitFor(() => expect(result.current.data).toBe('story two'));
      expect(result.current.loading).toBe(false);
    });
  });
});
