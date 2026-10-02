import { describe, expect, it, vi } from 'vitest';
import { createShutdown, installShutdownHandlers, type StoppableServer } from '../src/shutdown';

/** A clock that the fake `sleep` moves, so waiting costs no real time. */
function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      current += ms;
    },
  };
}

type Dependencies = Parameters<typeof createShutdown>[0];

function setup(overrides: Partial<Dependencies> = {}) {
  const events: string[] = [];
  const clock = fakeClock();
  const server = {
    pending: 0,
    get pendingRequests() {
      return this.pending;
    },
    stop: vi.fn((force?: boolean) => {
      events.push(force ? 'stop-force' : 'stop-graceful');
    }),
  } satisfies StoppableServer & { pending: number };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const exit = vi.fn((code: number) => {
    events.push(`exit-${code}`);
  });
  const dependencies: Dependencies = {
    getServer: () => server,
    stopSchedulers: vi.fn(() => {
      events.push('schedulers');
    }),
    announce: vi.fn((reason: string) => {
      events.push(`announce-${reason}`);
    }),
    drainBackground: vi.fn(async () => {
      events.push('drain');
      return { drained: true, remaining: 0 };
    }),
    closeDatabase: vi.fn(async () => {
      events.push('close-db');
    }),
    exit,
    log,
    requestGraceMs: 5000,
    pollMs: 100,
    ...clock,
    ...overrides,
  };
  return { shutdown: createShutdown(dependencies), dependencies, server, events, log, exit, clock };
}

describe('createShutdown', () => {
  it('does everything in order and exits with 0', async () => {
    const { shutdown, events } = setup();

    await shutdown.run('SIGTERM');

    expect(events).toEqual([
      'schedulers',
      'announce-SIGTERM',
      'stop-graceful',
      'stop-force',
      'drain',
      'close-db',
      'exit-0',
    ]);
    expect(shutdown.isShuttingDown).toBe(true);
  });

  it('lets running requests finish before closing the connections', async () => {
    const clock = fakeClock();
    const finishAt = [300, 700];
    const { shutdown, server, log, events, exit } = setup({
      now: clock.now,
      // Two requests that finish at 300 and 700 ms: the count falls as the fake clock moves.
      sleep: async (ms) => {
        await clock.sleep(ms);
        server.pending = finishAt.filter((at) => at > clock.now()).length;
      },
    });
    server.pending = 2;

    await shutdown.run('SIGINT');

    expect(server.pending).toBe(0);
    expect(clock.now()).toBeGreaterThanOrEqual(700);
    expect(clock.now()).toBeLessThan(5000);
    expect(log.warn).not.toHaveBeenCalled();
    expect(events.indexOf('stop-force')).toBeGreaterThan(events.indexOf('stop-graceful'));
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('gives up on requests that outlast the grace period, says so, and closes them', async () => {
    const { shutdown, server, log, events } = setup({ requestGraceMs: 1000 });
    server.pending = 3; // never finishes

    await shutdown.run('SIGTERM');

    expect(log.warn).toHaveBeenCalledWith('Shutdown: closing 3 request(s) still running.');
    expect(events).toContain('stop-force');
    expect(events.at(-1)).toBe('exit-0');
  });

  it('runs the rest of the steps when one fails, and still exits', async () => {
    const { shutdown, dependencies, log, events } = setup({
      announce: vi.fn(() => {
        throw new Error('audit unavailable');
      }),
      closeDatabase: vi.fn(async () => {
        throw new Error('pool already closed');
      }),
    });

    await shutdown.run('SIGTERM');

    expect(log.error).toHaveBeenCalledWith(
      'Shutdown: recording the shutdown failed',
      expect.any(Error),
    );
    expect(log.error).toHaveBeenCalledWith(
      'Shutdown: closing the database failed',
      expect.any(Error),
    );
    expect(dependencies.drainBackground).toHaveBeenCalled();
    expect(events.at(-1)).toBe('exit-0');
  });

  it('does not wait for a database close that hangs', async () => {
    const { shutdown, events } = setup({
      closeDatabase: () => new Promise<void>(() => undefined),
      databaseCloseMs: 3000,
    });

    await shutdown.run('SIGTERM');

    expect(events.at(-1)).toBe('exit-0');
  });

  it('warns when background writes did not finish in time', async () => {
    const { shutdown, log } = setup({
      drainBackground: vi.fn(async () => ({ drained: false, remaining: 2 })),
    });

    await shutdown.run('SIGTERM');

    expect(log.warn).toHaveBeenCalledWith(
      'Shutdown: 2 background write(s) did not finish in time.',
    );
  });

  it('runs only once however many times it is asked, keeping the first exit code', async () => {
    const { shutdown, exit, dependencies } = setup();

    await Promise.all([shutdown.run('uncaught exception', 1), shutdown.run('SIGTERM')]);

    expect(dependencies.closeDatabase).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('copes with a server that is not there yet (a signal during boot)', async () => {
    const { shutdown, dependencies, events } = setup({ getServer: () => null });

    await shutdown.run('SIGINT');

    expect(dependencies.closeDatabase).toHaveBeenCalled();
    expect(events).not.toContain('stop-graceful');
    expect(events.at(-1)).toBe('exit-0');
  });

  it('ends the process at once on a second signal', async () => {
    let release!: () => void;
    const { shutdown, exit } = setup({
      drainBackground: () =>
        new Promise((resolve) => {
          release = () => resolve({ drained: true, remaining: 0 });
        }),
    });

    shutdown.onSignal('SIGINT');
    await new Promise((resolve) => setImmediate(resolve));
    expect(exit).not.toHaveBeenCalled();
    shutdown.onSignal('SIGINT');
    expect(exit).toHaveBeenCalledWith(1);

    release();
    await shutdown.run('SIGINT');
  });
});

describe('installShutdownHandlers', () => {
  function fakeProcess(platform: NodeJS.Platform) {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const target = {
      platform,
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
      },
    } as unknown as Pick<NodeJS.Process, 'on' | 'platform'>;
    return { handlers, target };
  }

  it('turns the stop signals into a shutdown, and SIGBREAK only where it exists', () => {
    const shutdown = { run: vi.fn(), onSignal: vi.fn(), isShuttingDown: false };
    const unix = fakeProcess('linux');
    const windows = fakeProcess('win32');

    installShutdownHandlers(shutdown, { error: vi.fn() }, unix.target);
    installShutdownHandlers(shutdown, { error: vi.fn() }, windows.target);

    expect([...unix.handlers.keys()]).toEqual(
      expect.arrayContaining(['SIGINT', 'SIGTERM', 'SIGHUP']),
    );
    expect(unix.handlers.has('SIGBREAK')).toBe(false);
    expect(windows.handlers.has('SIGBREAK')).toBe(true);
    unix.handlers.get('SIGTERM')?.();
    expect(shutdown.onSignal).toHaveBeenCalledWith('SIGTERM');
  });

  it('stops in order after an uncaught exception, and only logs a rejection nobody awaited', () => {
    const shutdown = { run: vi.fn(), onSignal: vi.fn(), isShuttingDown: false };
    const log = { error: vi.fn() };
    const { handlers, target } = fakeProcess('linux');
    installShutdownHandlers(shutdown, log, target);

    handlers.get('unhandledRejection')?.(new Error('forgotten'));
    expect(log.error).toHaveBeenCalledWith('Unhandled promise rejection', expect.any(Error));
    expect(shutdown.run).not.toHaveBeenCalled();

    handlers.get('uncaughtException')?.(new Error('boom'));
    expect(log.error).toHaveBeenCalledWith('Uncaught exception', expect.any(Error));
    expect(shutdown.run).toHaveBeenCalledWith('uncaught exception', 1);
  });
});
