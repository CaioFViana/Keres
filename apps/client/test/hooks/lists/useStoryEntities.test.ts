import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

const mockLoggerError = jest.fn();

jest.mock('@/src/utils/logging/logger', () => ({
  __esModule: true,
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

const EVENTS = ['character_changed'] as const;

interface Row {
  id: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Props {
  storyId: string | undefined;
  enabled?: boolean;
  entityId?: string;
}

function renderList(load: (storyId: string) => Promise<Row[]>, initialProps: Props) {
  return renderHook<Row[], Props>(
    ({ storyId, enabled, entityId }) =>
      useStoryEntities({ storyId, load, events: EVENTS, label: 'rows', enabled, entityId }),
    { initialProps },
  );
}

describe('useStoryEntities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the rows of the story', async () => {
    const load = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const view = await renderList(load, { storyId: 'story-1' });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'a' }]));
    expect(load).toHaveBeenCalledWith('story-1');
  });

  it('stays empty and reads nothing without a story or while disabled', async () => {
    const load = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const view = await renderList(load, { storyId: undefined });
    expect(view.result.current).toEqual([]);

    await view.rerender({ storyId: 'story-1', enabled: false });
    expect(view.result.current).toEqual([]);
    expect(load).not.toHaveBeenCalled();

    await view.rerender({ storyId: 'story-1', enabled: true });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'a' }]));
  });

  it('reloads when an event reports a change in its story, and only then', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'a' }])
      .mockResolvedValueOnce([{ id: 'b' }]);
    const view = await renderList(load, { storyId: 'story-1' });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'a' }]));

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-2');
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1');
    });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'b' }]));
  });

  it('reloads an entity list only when the event names that entity', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'a' }])
      .mockResolvedValueOnce([{ id: 'b' }]);
    const view = await renderList(load, { storyId: 'story-1', entityId: 'e-1' });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'a' }]));

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'e-2');
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-2', 'e-1');
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'e-1');
    });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'b' }]));
  });

  it('drops a slow read that answers after a newer one', async () => {
    const slow = deferred<Row[]>();
    const fast = deferred<Row[]>();
    const load = jest.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const view = await renderList(load, { storyId: 'story-1' });

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1');
    });
    await act(async () => {
      fast.resolve([{ id: 'fresh' }]);
    });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'fresh' }]));

    await act(async () => {
      slow.resolve([{ id: 'stale' }]);
    });
    expect(view.result.current).toEqual([{ id: 'fresh' }]);
  });

  it('never shows the rows of the previous story, even before the new read lands', async () => {
    const next = deferred<Row[]>();
    const load = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'old' }])
      .mockReturnValueOnce(next.promise);
    const view = await renderList(load, { storyId: 'story-1' });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'old' }]));

    await view.rerender({ storyId: 'story-2' });
    expect(view.result.current).toEqual([]);

    await act(async () => {
      next.resolve([{ id: 'new' }]);
    });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'new' }]));
  });

  it('keeps the last rows and logs when a read fails', async () => {
    const failure = new Error('db down');
    const load = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'a' }])
      .mockRejectedValueOnce(failure);
    const view = await renderList(load, { storyId: 'story-1' });
    await waitFor(() => expect(view.result.current).toEqual([{ id: 'a' }]));

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1');
    });
    await waitFor(() =>
      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch rows:', failure),
    );
    expect(view.result.current).toEqual([{ id: 'a' }]);
  });

  it('ignores a read that lands after the screen is gone', async () => {
    const pending = deferred<Row[]>();
    const load = jest.fn().mockReturnValue(pending.promise);
    const view = await renderList(load, { storyId: 'story-1' });
    await view.unmount();
    await act(async () => {
      pending.resolve([{ id: 'late' }]);
    });
    expect(view.result.current).toEqual([]);
  });
});
