/**
 * @jest-environment node
 */
import { NO_RESPONSE_ERROR } from '../../src/services/apiClient';
import {
  FAILED_RETRY_MAX_MS,
  OFFLINE_RETRY_MS,
  SYNC_INTERVAL_MS,
  SyncScheduler,
  failedRetryDelayMs,
} from '../../src/services/sync/SyncScheduler';
import type { SyncCycleOutcome } from '../../src/services/sync/SyncScheduler';

const flush = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

describe('SyncScheduler', () => {
  let ready: { storyId: string | null; hasServer: boolean; hasDatabase: boolean };
  let performSync: jest.Mock<Promise<SyncCycleOutcome>, [AbortSignal]>;
  let scheduler: SyncScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ready = { storyId: 'story-1', hasServer: true, hasDatabase: true };
    performSync = jest.fn(async (_signal: AbortSignal) => 'ok' as SyncCycleOutcome);
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
    let finishFirst!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementationOnce(
      () => new Promise<SyncCycleOutcome>((resolve) => (finishFirst = resolve)),
    );

    scheduler.start();
    await flush();
    scheduler.request();
    scheduler.request();
    finishFirst('ok');
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
    performSync.mockResolvedValue('offline');
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(OFFLINE_RETRY_MS);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('recognises an unreachable-server exception and keeps the retry chain alive', async () => {
    performSync.mockRejectedValueOnce({ code: NO_RESPONSE_ERROR }).mockResolvedValue('ok');
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(OFFLINE_RETRY_MS);
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('logs an unexpected exception and backs off before retrying', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    performSync.mockRejectedValueOnce(new Error('broken')).mockResolvedValue('ok');
    scheduler.start();
    await flush();
    performSync.mockClear();

    jest.advanceTimersByTime(59_999);
    await flush();
    expect(performSync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();

    expect(console.error).toHaveBeenCalled();
    expect(performSync).toHaveBeenCalledTimes(1);
  });

  it('waits for the active cycle before reset completes', async () => {
    let finish!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementation(
      () => new Promise<SyncCycleOutcome>((resolve) => (finish = resolve)),
    );
    scheduler.start();
    await flush();

    let resetFinished = false;
    const reset = scheduler.reset().then(() => (resetFinished = true));
    await flush();
    expect(resetFinished).toBe(false);

    finish('ok');
    await reset;
    expect(resetFinished).toBe(true);
  });

  it('rejects new requests while waiting for the active cycle to stop', async () => {
    let finish!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementation(
      () => new Promise<SyncCycleOutcome>((resolve) => (finish = resolve)),
    );
    scheduler.start();
    await flush();

    const stopped = scheduler.stopAndWait();
    scheduler.request();
    finish('ok');
    await stopped;
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);

    scheduler.resume();
    scheduler.request();
    await flush();
    expect(performSync).toHaveBeenCalledTimes(2);
    finish('ok');
    await scheduler.stopAndWait();
  });

  it('resolves stopAndWait after the timeout even when the active cycle never finishes', async () => {
    performSync.mockImplementation(() => new Promise<SyncCycleOutcome>(() => undefined));
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
        new Promise<SyncCycleOutcome>((resolve) => {
          seenSignal = signal;
          signal.addEventListener('abort', () => resolve('ok'));
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
    let finish!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementation(
      () => new Promise<SyncCycleOutcome>((resolve) => (finish = resolve)),
    );
    scheduler.start();
    await flush();

    const stopped = scheduler.stopAndWait();
    scheduler.request();
    finish('ok');
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
    performSync.mockRejectedValueOnce(aborted).mockResolvedValue('ok');
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
    let finishFirst!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementationOnce(
      () => new Promise<SyncCycleOutcome>((resolve) => (finishFirst = resolve)),
    );
    scheduler.start();
    await flush();

    scheduler.request();
    scheduler.stop();
    finishFirst('ok');
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
    let finishFirst!: (outcome: SyncCycleOutcome) => void;
    performSync.mockImplementationOnce(
      () => new Promise<SyncCycleOutcome>((resolve) => (finishFirst = resolve)),
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
    finishFirst('ok');
    await flush();

    expect(performSync).toHaveBeenCalledTimes(1);
    racing.stop();
  });

  describe('failure backoff', () => {
    beforeEach(() => {
      // Neutral jitter so the exponential delays land on exact values.
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('backs off exponentially across consecutive failed cycles, capped at 5 minutes', async () => {
      performSync.mockResolvedValue('failed');
      scheduler.start();
      await flush();
      performSync.mockClear();

      for (const expected of [60_000, 120_000, 240_000, 300_000, 300_000]) {
        jest.advanceTimersByTime(expected - 1);
        await flush();
        expect(performSync).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await flush();
        expect(performSync).toHaveBeenCalledTimes(1);
        performSync.mockClear();
      }
      expect(FAILED_RETRY_MAX_MS).toBe(300_000);
    });

    it('resets the failure streak after an ok cycle', async () => {
      performSync
        .mockResolvedValueOnce('failed')
        .mockResolvedValueOnce('ok')
        .mockResolvedValue('failed');
      scheduler.start(1234);
      await flush();
      performSync.mockClear();

      jest.advanceTimersByTime(60_000);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
      performSync.mockClear();

      jest.advanceTimersByTime(1233);
      await flush();
      expect(performSync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
      performSync.mockClear();

      jest.advanceTimersByTime(59_999);
      await flush();
      expect(performSync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
    });

    it('drops the failure streak when the backoff is reset', async () => {
      performSync.mockResolvedValue('failed');
      scheduler.start();
      await flush();
      performSync.mockClear();

      scheduler.resetBackoff();

      // Without the reset the second failure would wait 120s; after it, the streak restarts at 60s.
      jest.advanceTimersByTime(60_000);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
      performSync.mockClear();

      jest.advanceTimersByTime(59_999);
      await flush();
      expect(performSync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
    });

    it('retries offline cycles fast without disturbing the failure streak', async () => {
      performSync
        .mockResolvedValueOnce('failed')
        .mockResolvedValueOnce('offline')
        .mockResolvedValue('failed');
      scheduler.start();
      await flush();
      performSync.mockClear();

      jest.advanceTimersByTime(60_000);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
      performSync.mockClear();

      jest.advanceTimersByTime(OFFLINE_RETRY_MS);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
      performSync.mockClear();

      jest.advanceTimersByTime(119_999);
      await flush();
      expect(performSync).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await flush();
      expect(performSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('failedRetryDelayMs', () => {
    it('doubles per consecutive failure from a 30s base', () => {
      expect(failedRetryDelayMs(1, () => 0.5)).toBe(60_000);
      expect(failedRetryDelayMs(2, () => 0.5)).toBe(120_000);
      expect(failedRetryDelayMs(3, () => 0.5)).toBe(240_000);
    });

    it('caps the delay at 5 minutes', () => {
      expect(failedRetryDelayMs(4, () => 0.5)).toBe(300_000);
      expect(failedRetryDelayMs(9, () => 0.5)).toBe(300_000);
    });

    it('applies ±25% jitter around the exponential delay', () => {
      expect(failedRetryDelayMs(1, () => 0)).toBe(45_000);
      expect(failedRetryDelayMs(1, () => 1)).toBe(75_000);
    });
  });
});
