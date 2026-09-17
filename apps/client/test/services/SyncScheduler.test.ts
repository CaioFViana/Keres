/**
 * @jest-environment node
 */
import { NO_RESPONSE_ERROR } from '../../src/services/apiClient';
import {
  OFFLINE_RETRY_MS,
  SYNC_INTERVAL_MS,
  SyncScheduler,
} from '../../src/services/sync/SyncScheduler';

const flush = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

describe('SyncScheduler', () => {
  let ready: { storyId: string | null; hasServer: boolean; hasDatabase: boolean };
  let performSync: jest.Mock<Promise<boolean>, [AbortSignal]>;
  let scheduler: SyncScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ready = { storyId: 'story-1', hasServer: true, hasDatabase: true };
    performSync = jest.fn(async (_signal: AbortSignal) => false);
    scheduler = new SyncScheduler({ readiness: () => ready, performSync });
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([
    ['story', { storyId: null, hasServer: true, hasDatabase: true }],
    ['server', { storyId: 'story-1', hasServer: false, hasDatabase: true }],
    ['database', { storyId: 'story-1', hasServer: true, hasDatabase: false }],
  ])('does not start without its %s prerequisite', async (_label, state) => {
    ready = state;

    scheduler.start();
    await flush();

    expect(performSync).not.toHaveBeenCalled();
  });

  it('coalesces an on-demand request made during an active cycle into one follow-up cycle', async () => {
    let finishFirst!: (offline: boolean) => void;
    performSync.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishFirst = resolve)),
    );

    scheduler.start();
    await flush();
    scheduler.request();
    scheduler.request();
    finishFirst(false);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(2);
  });

  it('ignores on-demand requests until all prerequisites exist', async () => {
    ready.hasServer = false;

    scheduler.request();
    await flush();

    expect(performSync).not.toHaveBeenCalled();
  });

  it('uses the requested healthy interval after a successful cycle', async () => {
    scheduler.start(1234);
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(1233);
    await flush();
    expect(performSync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
    expect(SYNC_INTERVAL_MS).toBe(30_000);
  });

  it('uses the offline cadence when a cycle reports the server unreachable', async () => {
    performSync.mockResolvedValue(true);
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(OFFLINE_RETRY_MS);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('recognises an unreachable-server exception and keeps the retry chain alive', async () => {
    performSync.mockRejectedValueOnce({ code: NO_RESPONSE_ERROR }).mockResolvedValue(false);
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(OFFLINE_RETRY_MS);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('logs an unexpected exception and returns to the healthy cadence', async () => {
    performSync.mockRejectedValueOnce(new Error('broken')).mockResolvedValue(false);
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(SYNC_INTERVAL_MS);
    await flush();

    expect(console.error).toHaveBeenCalled();
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('waits for the active cycle before reset completes', async () => {
    let finish!: (offline: boolean) => void;
    performSync.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    scheduler.start();
    await flush();

    let resetFinished = false;
    const reset = scheduler.reset().then(() => (resetFinished = true));
    await flush();
    expect(resetFinished).toBe(false);

    finish(false);
    await reset;
    expect(resetFinished).toBe(true);
  });

  it('rejects new requests while waiting for the active cycle to stop', async () => {
    let finish!: (offline: boolean) => void;
    performSync.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    scheduler.start();
    await flush();

    const stopped = scheduler.stopAndWait();
    scheduler.request();
    finish(false);
    await stopped;
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);

    scheduler.resume();
    scheduler.request();
    await flush();
    expect(performSync).toHaveBeenCalledTimes(2);
    finish(false);
    await scheduler.stopAndWait();
  });

  it('resolves stopAndWait after the timeout even when the active cycle never finishes', async () => {
    performSync.mockImplementation(() => new Promise<boolean>(() => undefined));
    scheduler.start();
    await flush();

    const stopped = scheduler.stopAndWait(20);
    await jest.advanceTimersByTimeAsync(20);
    await expect(stopped).resolves.toBe('timed_out');
  });

  it('aborts the active cycle signal when stop runs', async () => {
    let seenSignal: AbortSignal | undefined;
    performSync.mockImplementation(
      (signal) =>
        new Promise<boolean>((resolve) => {
          seenSignal = signal;
          signal.addEventListener('abort', () => resolve(false));
        }),
    );
    scheduler.start();
    await flush();

    expect(seenSignal?.aborted).toBe(false);
    scheduler.stop();
    expect(seenSignal?.aborted).toBe(true);
    await flush();
  });

  it('does not coalesce queued work onto a cycle that was stopped', async () => {
    let finish!: (offline: boolean) => void;
    performSync.mockImplementation(() => new Promise<boolean>((resolve) => (finish = resolve)));
    scheduler.start();
    await flush();

    const stopped = scheduler.stopAndWait();
    scheduler.request();
    finish(false);
    await expect(stopped).resolves.toBe('idle');
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('ignores a second start while running', async () => {
    scheduler.start();
    await flush();
    expect(scheduler.isRunning).toBe(true);

    scheduler.start();
    await flush();

    expect(console.log).toHaveBeenCalledWith('Sync engine already running.');
    expect(performSync).toHaveBeenCalledTimes(1);

    scheduler.stop();
    expect(scheduler.isRunning).toBe(false);
  });

  /**
   * An aborted cycle is neither a failure nor an offline signal: the stop was requested, so the
   * chain continues on the healthy cadence instead of switching to the fast retry one.
   */
  it('treats an aborted cycle as neither failure nor offline', async () => {
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    performSync.mockRejectedValueOnce(aborted).mockResolvedValue(false);
    scheduler.start();
    await flush();
    performSync.mockClear();

    expect(console.log).toHaveBeenCalledWith('SyncEngineService: sync cycle aborted.');
    jest.advanceTimersByTime(SYNC_INTERVAL_MS);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('logs an on-demand request whose cycle throws', async () => {
    performSync.mockRejectedValueOnce(new Error('boom'));

    scheduler.request();
    await flush();

    expect(console.log).toHaveBeenCalledWith(
      'SyncEngineService: on-demand sync failed.',
      expect.any(Error),
    );
  });

  it('resolves stopAndWait immediately when no cycle is active', async () => {
    await expect(scheduler.stopAndWait(50)).resolves.toBe('idle');
  });

  /**
   * A request queued while a cycle runs is dropped when the scheduler stops before the follow-up
   * starts: the stop owns the state now, and rerunning the sync right after it would push against
   * a story that may already be deactivated.
   */
  it('drops queued work when the scheduler stops before the follow-up starts', async () => {
    let finishFirst!: (offline: boolean) => void;
    performSync.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishFirst = resolve)),
    );
    scheduler.start();
    await flush();

    scheduler.request();
    scheduler.stop();
    finishFirst(false);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  /**
   * The coalescing guard: a stop landing between the readiness check and the cycle must not queue
   * follow-up work onto the abandoned cycle. The window is a synchronous prefix in production, so
   * the test forces the interleaving with a readiness that stops the scheduler - without the
   * guard, the abandoned cycle would rerun the sync once more.
   */
  it('does not queue a request when a stop lands inside the readiness check', async () => {
    let finishFirst!: (offline: boolean) => void;
    performSync.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishFirst = resolve)),
    );
    let stopInsideReadiness = false;
    const racing = new SyncScheduler({
      readiness: () => {
        if (stopInsideReadiness) racing.stop();
        return ready;
      },
      performSync,
    });
    racing.start();
    await flush();

    stopInsideReadiness = true;
    racing.request();
    finishFirst(false);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
    racing.stop();
  });
});
