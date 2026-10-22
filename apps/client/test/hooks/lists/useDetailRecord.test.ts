import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';

const mockLoggerError = jest.fn();

jest.mock('@/src/utils/logging/logger', () => ({
  __esModule: true,
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

interface Row {
  id: string;
  name: string;
  isDeleted?: boolean;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const onGone = jest.fn();

const ALSO_ON = ['tag_relation_changed'] as const;

function renderRecord(load: (id: string) => Promise<Row | null | undefined>, id = 'r-1') {
  return renderHook(() =>
    useDetailRecord<Row>({
      id,
      load,
      event: 'character_changed',
      alsoOn: ALSO_ON,
      label: 'row',
      onGone,
    }),
  );
}

describe('useDetailRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the loading state, then the record', async () => {
    const pending = deferred<Row>();
    const load = jest.fn().mockReturnValue(pending.promise);
    const view = await renderRecord(load);
    expect(view.result.current.loading).toBe(true);
    await act(async () => {
      pending.resolve({ id: 'r-1', name: 'Alice' });
    });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.record).toEqual({ id: 'r-1', name: 'Alice' });
    expect(view.result.current.failure).toBeNull();
    expect(load).toHaveBeenCalledWith('r-1');
  });

  it('reports a missing record as not found', async () => {
    const view = await renderRecord(jest.fn().mockResolvedValue(undefined));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.failure).toBe('notFound');
    expect(onGone).not.toHaveBeenCalled();
  });

  it('reports a failed read and logs it', async () => {
    const failure = new Error('db down');
    const view = await renderRecord(jest.fn().mockRejectedValue(failure));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.failure).toBe('failed');
    expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch row:', failure);
  });

  it('leaves the screen for a deleted record', async () => {
    const view = await renderRecord(
      jest.fn().mockResolvedValue({ id: 'r-1', name: 'Alice', isDeleted: true }),
    );
    await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.record).toBeNull();
  });

  it('refreshes silently when its own record changes, and ignores other records', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alice' })
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alicia' });
    const view = await renderRecord(load);
    await waitFor(() => expect(view.result.current.record?.name).toBe('Alice'));

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'r-2');
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'r-1');
    });
    expect(view.result.current.loading).toBe(false);
    await waitFor(() => expect(view.result.current.record?.name).toBe('Alicia'));
  });

  it('also refreshes on the extra events that name the record', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alice' })
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alice tagged' });
    const view = await renderRecord(load);
    await waitFor(() => expect(view.result.current.record?.name).toBe('Alice'));

    await act(async () => {
      entityEventEmitter.emit('tag_relation_changed', 'story-1', 'r-2');
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      entityEventEmitter.emit('tag_relation_changed', 'story-1', 'r-1');
    });
    await waitFor(() => expect(view.result.current.record?.name).toBe('Alice tagged'));
  });

  it('leaves the screen when the record is deleted elsewhere', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alice' })
      .mockResolvedValueOnce(undefined);
    const view = await renderRecord(load);
    await waitFor(() => expect(view.result.current.record).not.toBeNull());

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'r-1');
    });
    await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1));
  });

  it('keeps the record on screen when a refresh fails', async () => {
    const failure = new Error('db down');
    const load = jest
      .fn()
      .mockResolvedValueOnce({ id: 'r-1', name: 'Alice' })
      .mockRejectedValueOnce(failure);
    const view = await renderRecord(load);
    await waitFor(() => expect(view.result.current.record).not.toBeNull());

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'r-1');
    });
    await waitFor(() =>
      expect(mockLoggerError).toHaveBeenCalledWith('Failed to fetch row:', failure),
    );
    expect(view.result.current.record?.name).toBe('Alice');
    expect(view.result.current.failure).toBeNull();
    expect(view.result.current.loading).toBe(false);
  });

  it('drops a slow read that answers after a newer one', async () => {
    const slow = deferred<Row>();
    const fast = deferred<Row>();
    const load = jest.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const view = await renderRecord(load);

    await act(async () => {
      entityEventEmitter.emit('character_changed', 'story-1', 'r-1');
    });
    await act(async () => {
      fast.resolve({ id: 'r-1', name: 'Fresh' });
    });
    await waitFor(() => expect(view.result.current.record?.name).toBe('Fresh'));
    expect(view.result.current.loading).toBe(false);

    await act(async () => {
      slow.resolve({ id: 'r-1', name: 'Stale' });
    });
    expect(view.result.current.record?.name).toBe('Fresh');
  });

  it('ignores a read that lands after the screen is gone', async () => {
    const pending = deferred<Row>();
    const view = await renderRecord(jest.fn().mockReturnValue(pending.promise));
    await view.unmount();
    await act(async () => {
      pending.resolve({ id: 'r-1', name: 'Late' });
    });
    expect(view.result.current.record).toBeNull();
  });
});
