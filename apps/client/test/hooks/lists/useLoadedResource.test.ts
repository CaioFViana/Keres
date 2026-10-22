import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import type { EntityEventName } from '@/src/state/events/entityEvents';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

const mockLoggerError = jest.fn();

jest.mock('@/src/utils/logging/logger', () => ({
  __esModule: true,
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

const INITIAL = 'nothing';
const EVENTS: readonly EntityEventName[] = ['song_changed'];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

interface Props {
  load: ((refreshKey: unknown) => Promise<string>) | null;
  storyId?: string;
  entityId?: string;
  refreshKey?: unknown;
}

function renderResource(initialProps: Props) {
  return renderHook<ReturnType<typeof useLoadedResource<string>>, Props>(
    ({ load, storyId, entityId, refreshKey }) =>
      useLoadedResource<string>({
        load,
        initial: INITIAL,
        events: EVENTS,
        storyId,
        entityId,
        refreshKey,
        label: 'thing',
      }),
    { initialProps },
  );
}

describe('useLoadedResource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is loading until the first read lands, then shows the data', async () => {
    const pending = deferred<string>();
    const view = await renderResource({ load: () => pending.promise });
    expect(view.result.current).toMatchObject({ data: INITIAL, loading: true });

    await act(async () => {
      pending.resolve('first');
    });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.data).toBe('first');
  });

  it('has nothing to show and is not loading when there is nothing to read', async () => {
    const view = await renderResource({ load: null });
    expect(view.result.current).toMatchObject({ data: INITIAL, loading: false });
  });

  it('reloads silently on an event: the old data stays and loading stays off', async () => {
    const next = deferred<string>();
    const load = jest.fn().mockResolvedValueOnce('first').mockReturnValueOnce(next.promise);
    const stable = () => load();
    const view = await renderResource({ load: stable });
    await waitFor(() => expect(view.result.current.data).toBe('first'));

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-1');
    });
    expect(view.result.current).toMatchObject({ data: 'first', loading: false });

    await act(async () => {
      next.resolve('second');
    });
    await waitFor(() => expect(view.result.current.data).toBe('second'));
  });

  it('narrows events by story and by entity', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const stable = () => load();
    const view = await renderResource({ load: stable, storyId: 'story-1', entityId: 'e-1' });
    await waitFor(() => expect(view.result.current.data).toBe('value'));
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-2', 'e-1');
      entityEventEmitter.emit('song_changed', 'story-1', 'e-2');
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-1', 'e-1');
    });
    expect(load).toHaveBeenCalledTimes(2);

    // An event that names no entity concerns all of them.
    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-1');
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('reloads on every event when it is not narrowed', async () => {
    const load = jest.fn().mockResolvedValue('value');
    const stable = () => load();
    await renderResource({ load: stable });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await act(async () => {
      entityEventEmitter.emit('song_changed', 'any-story');
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('never shows data read for another resource', async () => {
    const readA = () => Promise.resolve('A');
    const pendingB = deferred<string>();
    const readB = () => pendingB.promise;
    const view = await renderResource({ load: readA });
    await waitFor(() => expect(view.result.current.data).toBe('A'));

    await view.rerender({ load: readB });
    expect(view.result.current).toMatchObject({ data: INITIAL, loading: true });

    await act(async () => {
      pendingB.resolve('B');
    });
    await waitFor(() => expect(view.result.current.data).toBe('B'));
  });

  it('drops a slow read that answers after a newer one', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const load = jest.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const stable = () => load();
    const view = await renderResource({ load: stable });

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-1');
    });
    await act(async () => {
      fast.resolve('fresh');
    });
    await waitFor(() => expect(view.result.current.data).toBe('fresh'));

    await act(async () => {
      slow.resolve('stale');
    });
    expect(view.result.current.data).toBe('fresh');
  });

  it('settles on the initial value and logs when the first read fails', async () => {
    const failure = new Error('db down');
    const view = await renderResource({ load: () => Promise.reject(failure) });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.data).toBe(INITIAL);
    expect(view.result.current.failed).toBe(true);
    expect(view.result.current.error).toBe(failure);
    expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch thing:', failure);
  });

  it('keeps what was read when a later read fails', async () => {
    const failure = new Error('db down');
    const load = jest.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(failure);
    const stable = () => load();
    const view = await renderResource({ load: stable });
    await waitFor(() => expect(view.result.current.data).toBe('first'));

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'story-1');
    });
    await waitFor(() =>
      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch thing:', failure),
    );
    expect(view.result.current).toMatchObject({ data: 'first', loading: false });
  });

  it('reads again, silently, when the refresh key changes', async () => {
    const next = deferred<string>();
    const load = jest.fn().mockResolvedValueOnce('first').mockReturnValueOnce(next.promise);
    const stable = () => load();
    const view = await renderResource({ load: stable, refreshKey: 1 });
    await waitFor(() => expect(view.result.current.data).toBe('first'));

    await view.rerender({ load: stable, refreshKey: 2 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(view.result.current).toMatchObject({ data: 'first', loading: false });

    await act(async () => {
      next.resolve('second');
    });
    await waitFor(() => expect(view.result.current.data).toBe('second'));
  });

  it('goes back to loading on a retry', async () => {
    const failure = new Error('db down');
    const retried = deferred<string>();
    const load = jest.fn().mockRejectedValueOnce(failure).mockReturnValueOnce(retried.promise);
    const stable = () => load();
    const view = await renderResource({ load: stable });
    await waitFor(() => expect(view.result.current.failed).toBe(true));

    await act(async () => {
      view.result.current.retry();
    });
    expect(view.result.current).toMatchObject({ data: INITIAL, loading: true, failed: false });

    await act(async () => {
      retried.resolve('fixed');
    });
    await waitFor(() => expect(view.result.current.data).toBe('fixed'));
  });

  it('hands the current refresh key to the read', async () => {
    const seen: unknown[] = [];
    const load = (key: unknown) => {
      seen.push(key);
      return Promise.resolve(`read-${String(key)}`);
    };
    const view = await renderResource({ load, refreshKey: 'a' });
    await waitFor(() => expect(view.result.current.data).toBe('read-a'));

    await view.rerender({ load, refreshKey: 'b' });
    await waitFor(() => expect(view.result.current.data).toBe('read-b'));
    expect(seen).toEqual(['a', 'b']);

    await act(async () => {
      entityEventEmitter.emit('song_changed', 'any-story');
    });
    expect(seen).toEqual(['a', 'b', 'b']);
  });

  it('hands out a reload that can be awaited', async () => {
    const load = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const stable = () => load();
    const view = await renderResource({ load: stable });
    await waitFor(() => expect(view.result.current.data).toBe('first'));

    await act(async () => {
      await view.result.current.reload();
    });
    expect(view.result.current.data).toBe('second');
  });

  it('ignores a read that lands after the screen is gone', async () => {
    const pending = deferred<string>();
    const view = await renderResource({ load: () => pending.promise });
    await view.unmount();
    await act(async () => {
      pending.resolve('late');
    });
    expect(view.result.current.data).toBe(INITIAL);
  });
});
