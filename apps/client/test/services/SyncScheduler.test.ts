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
  let performSync: jest.Mock<Promise<boolean>, []>;
  let scheduler: SyncScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ready = { storyId: 'story-1', hasServer: true, hasDatabase: true };
    performSync = jest.fn().mockResolvedValue(false);
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
});
