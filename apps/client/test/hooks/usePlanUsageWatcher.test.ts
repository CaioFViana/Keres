const mockRefresh = jest.fn();
const mockClear = jest.fn();
const mockListeners = new Map<string, Set<(...args: unknown[]) => void>>();

jest.mock('../../src/services/PlanUsageService', () => ({
  __esModule: true,
  refreshPlanUsage: (...args: unknown[]) => mockRefresh(...args),
}));
jest.mock('../../src/state/planUsageStore', () => ({
  __esModule: true,
  usePlanUsageStore: { getState: () => ({ clear: mockClear }) },
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!mockListeners.has(event)) mockListeners.set(event, new Set());
      mockListeners.get(event)!.add(listener);
    },
    off: (event: string, listener: (...args: unknown[]) => void) => {
      mockListeners.get(event)?.delete(listener);
    },
  },
}));

import { act, renderHook } from '@testing-library/react-native';
import { usePlanUsageWatcher } from '../../src/hooks/usePlanUsageWatcher';

const db = {} as never;
const story = { id: 'story-1', serverId: 'server-1' };
const emit = (...args: unknown[]) =>
  mockListeners.get('operation_log_updated')?.forEach((listener) => listener(...args));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListeners.clear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('usePlanUsageWatcher', () => {
  it('looks at the plan usage when the story opens', async () => {
    await renderHook(() => usePlanUsageWatcher(db, story));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith(db, { id: 'story-1', serverId: 'server-1' });
  });

  it('looks again once, after a burst of writes to this story settles', async () => {
    await renderHook(() => usePlanUsageWatcher(db, story));
    mockRefresh.mockClear();

    await act(async () => {
      emit('story-1');
      jest.advanceTimersByTime(500);
      emit('story-1');
      emit(undefined);
      jest.advanceTimersByTime(1999);
    });
    expect(mockRefresh).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('ignores what happens in other stories', async () => {
    await renderHook(() => usePlanUsageWatcher(db, story));
    mockRefresh.mockClear();

    await act(async () => {
      emit('another-story');
      jest.advanceTimersByTime(10_000);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('clears the indicator when no story is open, and when the database is not ready', async () => {
    await renderHook(() => usePlanUsageWatcher(db, null));
    await renderHook(() => usePlanUsageWatcher(undefined, story));

    expect(mockClear).toHaveBeenCalledTimes(2);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('follows the story, and stops listening and looking once it unmounts', async () => {
    const hook = await renderHook(
      ({ current }: { current: typeof story }) => usePlanUsageWatcher(db, current),
      { initialProps: { current: story } },
    );
    await hook.rerender({ current: { id: 'story-2', serverId: 'server-1' } });
    expect(mockRefresh).toHaveBeenLastCalledWith(db, { id: 'story-2', serverId: 'server-1' });
    expect(mockListeners.get('operation_log_updated')?.size).toBe(1);

    await act(async () => {
      emit('story-2');
    });
    await hook.unmount();
    mockRefresh.mockClear();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockListeners.get('operation_log_updated')?.size).toBe(0);
  });
});
