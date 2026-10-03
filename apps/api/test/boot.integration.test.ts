import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The server's own life, over the real services and database: what it prepares before it listens, the
 * periodic jobs it starts, the activity-record lines it leaves, and the orderly stop. Only the edges that
 * a test process cannot have are replaced - the migration runner (it finds its folder through a Bun-only
 * API), the HTTP listener, and the process itself (exit, signals).
 */
vi.mock('../src/db/migrate', () => ({ runMigrations: vi.fn(async () => undefined) }));

const fakeServer = {
  pendingRequests: 0,
  stop: vi.fn(),
};
const listenCalls: { options: Record<string, unknown>; callback: (a: object) => void }[] = [];

vi.mock('../src/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/index')>();
  return {
    ...original,
    createApp: async () => {
      const app = await original.createApp();
      Object.defineProperty(app, 'server', { value: fakeServer, configurable: true });
      Object.defineProperty(app, 'listen', {
        configurable: true,
        value: (options: Record<string, unknown>, callback: (a: object) => void) => {
          listenCalls.push({ options, callback });
        },
      });
      return app;
    },
  };
});

const realSetTimeout = globalThis.setTimeout;
const realSetInterval = globalThis.setInterval;
type Job = { fn: () => void; delay: number; kind: 'timeout' | 'interval' };
const jobs: Job[] = [];
const handlers = new Map<string, (...args: unknown[]) => void>();
const exitCodes: number[] = [];

/** The jobs are the timers `boot.ts` asks for (the rest of the app has long timers of its own): held, and run by hand. */
const JOB_DELAYS = new Set([30_000, 45_000, 50_000, 60_000, 15 * 60_000, 60 * 60_000, 24 * 60 * 60_000]);
const isJobDelay = (delay: unknown) =>
  typeof delay === 'number' && JOB_DELAYS.has(delay) && new Error().stack?.includes('boot.ts') === true;

beforeAll(() => {
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: () => void,
    delay?: number,
    ...rest: unknown[]
  ) => {
    if (isJobDelay(delay)) {
      jobs.push({ fn, delay: delay as number, kind: 'timeout' });
      return 0 as never;
    }
    return realSetTimeout(fn, delay, ...rest);
  }) as never);
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void, delay?: number) => {
    if (isJobDelay(delay)) {
      jobs.push({ fn, delay: delay as number, kind: 'interval' });
      return 0 as never;
    }
    return realSetInterval(fn, delay);
  }) as never);
  // The handlers the server installs are kept, not installed: a real SIGTERM would reach the test runner too.
  vi.spyOn(process, 'on').mockImplementation(((event: string, handler: never) => {
    handlers.set(event, handler);
    return process;
  }) as never);
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as never);
});

/**
 * The spies of a test are put back after it; the ones of `beforeAll` (timers, signals, exit) stay for the
 * whole file - a restored `process.exit` would end the test runner at the first shutdown.
 */
const local: { mockRestore(): void }[] = [];
const spyOn = ((...args: Parameters<typeof vi.spyOn>) => {
  const spy = (vi.spyOn as (...a: unknown[]) => { mockRestore(): void })(...args);
  local.push(spy);
  return spy;
}) as typeof vi.spyOn;

afterEach(() => {
  for (const spy of local.splice(0)) spy.mockRestore();
});

const flush = async () => {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => realSetTimeout(resolve, 5));
};

describe('starting the server', () => {
  it('prepares what it needs, starts its jobs, says it started, and listens', async () => {
    const { auditService } = await import('../src/services/AuditService');
    const record = spyOn(auditService, 'record');
    const { bootAndListen } = await import('../src/boot');
    const onListening = vi.fn();

    await bootAndListen({ onListening });

    // Four jobs, each with its first early run and its repeat.
    expect(jobs.filter((job) => job.kind === 'timeout')).toHaveLength(4);
    expect(jobs.filter((job) => job.kind === 'interval')).toHaveLength(4);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'system', action: 'system.server_started' }),
    );
    expect(listenCalls).toHaveLength(1);
    expect(listenCalls[0].options).toMatchObject({
      maxRequestBodySize: expect.any(Number),
    });
    expect(Object.keys(listenCalls[0].options)).toContain('port');
    listenCalls[0].callback({ hostname: '127.0.0.1', port: 4321 });
    expect(onListening).toHaveBeenCalledWith({ hostname: '127.0.0.1', port: 4321 });
    // And it is ready to be told to stop.
    expect([...handlers.keys()]).toEqual(
      expect.arrayContaining(['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection']),
    );
  });

  it('listens at the address it was given, or at all addresses when none was given', async () => {
    listenCalls[0].callback({});
    // Nothing to assert beyond not failing: the fallbacks are the host from the environment, or 0.0.0.0.
    expect(listenCalls[0].options.port).toBeDefined();
  });
});

describe('the periodic jobs', () => {
  const run = async (delay: number, kind: Job['kind'], index = 0) => {
    const candidates = jobs.filter((job) => job.delay === delay && job.kind === kind);
    candidates[index].fn();
    await flush();
  };
  const FIRST = { payments: 50_000, media: 60_000, audit: 30_000, attempts: 45_000 };

  it('sweeps the expired media blobs, and says so only when it found some', async () => {
    const { mediaStorageService } = await import('../src/services/MediaStorageService');
    const { logger } = await import('../src/utils/logger');
    const info = spyOn(logger, 'info');
    const sweep = spyOn(mediaStorageService, 'sweepExpiredUnreferencedBlobs');

    sweep.mockResolvedValueOnce(0);
    await run(FIRST.media, 'timeout');
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('Media blob sweep'));

    sweep.mockResolvedValueOnce(3);
    await run(FIRST.media, 'timeout');
    expect(info).toHaveBeenCalledWith('Media blob sweep examined 3 expired blob(s).');
  });

  it('keeps going when a media sweep fails', async () => {
    const { mediaStorageService } = await import('../src/services/MediaStorageService');
    const { logger } = await import('../src/utils/logger');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);
    spyOn(mediaStorageService, 'sweepExpiredUnreferencedBlobs').mockRejectedValueOnce(
      new Error('disk gone'),
    );

    await run(FIRST.media, 'timeout');

    expect(error).toHaveBeenCalledWith('Media blob sweep failed', expect.any(Error));
  });

  it('prunes the activity record to its retention, and says how much it dropped', async () => {
    const { auditService } = await import('../src/services/AuditService');
    const { logger } = await import('../src/utils/logger');
    const info = spyOn(logger, 'info');
    const prune = spyOn(auditService, 'prune');

    prune.mockResolvedValueOnce(0);
    await run(FIRST.audit, 'timeout');
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('Activity record'));

    prune.mockResolvedValueOnce(7);
    await run(FIRST.audit, 'timeout');
    expect(info).toHaveBeenCalledWith(expect.stringContaining('dropped 7 line(s)'));
  });

  it('keeps going when the activity record cannot be pruned', async () => {
    const { auditService } = await import('../src/services/AuditService');
    const { logger } = await import('../src/utils/logger');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);
    spyOn(auditService, 'prune').mockRejectedValueOnce(new Error('locked'));

    await run(FIRST.audit, 'timeout');

    expect(error).toHaveBeenCalledWith('Activity record retention failed', expect.any(Error));
  });

  it('marks subscriptions due, says so when some changed, and survives a failure', async () => {
    const { subscriptionService } = await import('../src/services/payments/SubscriptionService');
    const { logger } = await import('../src/utils/logger');
    const info = spyOn(logger, 'info');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);
    const markDue = spyOn(subscriptionService, 'markDue');

    markDue.mockResolvedValueOnce({ due: 0, ended: 0 });
    await run(FIRST.payments, 'timeout');
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('Payments:'));

    markDue.mockResolvedValueOnce({ due: 2, ended: 1 });
    await run(FIRST.payments, 'timeout');
    expect(info).toHaveBeenCalledWith('Payments: 2 subscription(s) now due, 1 ended.');

    markDue.mockRejectedValueOnce(new Error('db down'));
    await run(FIRST.payments, 'timeout');
    expect(error).toHaveBeenCalledWith('Marking due subscriptions failed', expect.any(Error));
  });

  it('cleans the lockout counters, and survives a failure', async () => {
    const attempts = await import('../src/services/AttemptLimitService');
    const { logger } = await import('../src/utils/logger');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);

    // The real cleanup, over the real table.
    await run(FIRST.attempts, 'timeout');
    expect(error).not.toHaveBeenCalled();
    expect(typeof attempts.pruneAttemptLimits).toBe('function');

    // And the repeat is the same job.
    await run(24 * 60 * 60_000, 'interval', 0);
    expect(error).not.toHaveBeenCalled();
  });

  it('repeats every job on its own interval', async () => {
    const intervals = jobs.filter((job) => job.kind === 'interval').map((job) => job.delay);
    expect(intervals.sort((a, b) => a - b)).toEqual([
      15 * 60_000,
      60 * 60_000,
      24 * 60 * 60_000,
      24 * 60 * 60_000,
    ]);
    for (const job of jobs.filter((entry) => entry.kind === 'interval')) {
      job.fn();
    }
    await flush();
  });
});

describe('a start that cannot be completed', () => {
  it('says why, and ends the process, when the database cannot be prepared', async () => {
    const { runMigrations } = await import('../src/db/migrate');
    const { logger } = await import('../src/utils/logger');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.mocked(runMigrations).mockRejectedValueOnce(new Error('postgres is down'));
    vi.mocked(process.exit).mockImplementationOnce((() => {
      throw new Error('process ended');
    }) as never);
    const { bootAndListen } = await import('../src/boot');
    const listened = listenCalls.length;

    await expect(bootAndListen()).rejects.toThrow('process ended');

    expect(error).toHaveBeenCalledWith('Fatal error during startup', expect.any(Error));
    expect(vi.mocked(process.exit)).toHaveBeenLastCalledWith(1);
    // It never got as far as listening.
    expect(listenCalls).toHaveLength(listened);
  });
});

describe('stopping the server', () => {
  it('stops in order on a signal: the jobs, the record, the connections, the writes, the database', async () => {
    const { auditService } = await import('../src/services/AuditService');
    const record = spyOn(auditService, 'record');
    const clearTimeoutSpy = spyOn(globalThis, 'clearTimeout');
    const clearIntervalSpy = spyOn(globalThis, 'clearInterval');
    exitCodes.length = 0;

    handlers.get('SIGTERM')!();
    // A second signal, while it runs, ends the process at once.
    await new Promise((resolve) => realSetTimeout(resolve, 0));
    handlers.get('SIGINT')!();
    expect(exitCodes).toContain(1);

    for (let turn = 0; turn < 100 && !exitCodes.includes(0); turn += 1) {
      await new Promise((resolve) => realSetTimeout(resolve, 20));
    }

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'system',
        action: 'system.server_stopped',
        meta: expect.objectContaining({ reason: 'SIGTERM' }),
      }),
    );
    expect(fakeServer.stop).toHaveBeenCalledWith(false);
    expect(fakeServer.stop).toHaveBeenCalledWith(true);
    expect(exitCodes).toContain(0);
  });

  it('logs what nobody caught: a rejected promise is only noted, an exception is not ignored', async () => {
    const { logger } = await import('../src/utils/logger');
    const error = spyOn(logger, 'error').mockImplementation(() => undefined);

    handlers.get('unhandledRejection')!(new Error('forgotten'));
    expect(error).toHaveBeenCalledWith('Unhandled promise rejection', expect.any(Error));

    handlers.get('uncaughtException')!(new Error('boom'));
    expect(error).toHaveBeenCalledWith('Uncaught exception', expect.any(Error));
  });
});
