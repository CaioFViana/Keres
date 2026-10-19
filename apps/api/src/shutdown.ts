/**
 * The orderly end of the server.
 *
 * A server that is simply killed leaves requests cut in the middle (a publication half-compiled, a sync
 * push whose answer never arrives), the last lines of the activity record and the technical log unwritten,
 * and database connections hanging until Postgres gives up on them. A stopping server instead:
 *
 *   1. stops the periodic jobs;
 *   2. notes in the activity record that it is stopping;
 *   3. stops taking new connections, and lets the requests already running finish - for a bounded time;
 *   4. closes whatever is still open (long-lived sockets, requests past the time);
 *   5. waits for the writes started without anybody waiting (record, log) to land;
 *   6. closes the database.
 *
 * Every step is attempted whatever happened to the one before: a failure is logged and the shutdown goes
 * on, because the one outcome that is not acceptable is a process that never ends. A second signal while
 * this runs ends the process at once - the usual way out for an operator who is tired of waiting.
 */

/** What the shutdown needs of the HTTP server (Bun's `Server`, in production). */
export interface StoppableServer {
  /** Without `true`, stops accepting connections and lets the running requests finish. */
  stop(closeActiveConnections?: boolean): unknown;
  readonly pendingRequests: number;
}

export interface ShutdownDependencies {
  /** The server, once there is one; null while still booting. */
  getServer: () => StoppableServer | null;
  /** Clears the periodic jobs. */
  stopSchedulers: () => void;
  /** Leaves a line saying the server is stopping, and why. Not awaited: the drain below waits for it. */
  announce: (reason: string) => void;
  drainBackground: (timeoutMs: number) => Promise<{ drained: boolean; remaining: number }>;
  closeDatabase: () => Promise<void>;
  exit: (code: number) => void;
  log: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => void;
  };
  /** How long running requests may keep going after the stop. */
  requestGraceMs: number;
  /** How long the background writes get. */
  backgroundGraceMs?: number;
  /** How long closing the database may take. */
  databaseCloseMs?: number;
  /** How often the running requests are counted while waiting. */
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface Shutdown {
  /** Runs the shutdown (once - later calls get the same promise) and exits with `exitCode`. */
  run(reason: string, exitCode?: number): Promise<void>;
  /** For a signal: the first one starts the shutdown, a second one ends the process right away. */
  onSignal(signal: string): void;
  readonly isShuttingDown: boolean;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createShutdown(dependencies: ShutdownDependencies): Shutdown {
  const {
    log,
    getServer,
    requestGraceMs,
    backgroundGraceMs = 2000,
    databaseCloseMs = 3000,
    pollMs = 100,
  } = dependencies;
  const sleep = dependencies.sleep ?? defaultSleep;
  const now = dependencies.now ?? Date.now;
  let running: Promise<void> | null = null;

  /** One step that must not stop the others from running. */
  const attempt = async (what: string, step: () => unknown): Promise<void> => {
    try {
      await step();
    } catch (error) {
      log.error(`Shutdown: ${what} failed`, error);
    }
  };

  const waitForRequests = async (server: StoppableServer): Promise<void> => {
    const deadline = now() + requestGraceMs;
    while (server.pendingRequests > 0 && now() < deadline) {
      await sleep(Math.min(pollMs, Math.max(0, deadline - now())));
    }
    if (server.pendingRequests > 0) {
      log.warn(`Shutdown: closing ${server.pendingRequests} request(s) still running.`);
    }
  };

  const perform = async (reason: string, exitCode: number): Promise<void> => {
    log.info(`Shutting down (${reason}).`);
    await attempt('stopping the periodic jobs', dependencies.stopSchedulers);
    await attempt('recording the shutdown', () => dependencies.announce(reason));

    const server = getServer();
    if (server) {
      // Not awaited: with `false`, Bun's promise settles only when every connection is gone, and a
      // WebSocket never goes by itself - the wait below is the one with a limit.
      await attempt('refusing new connections', () => {
        void Promise.resolve(server.stop(false)).catch((error: unknown) =>
          log.error('Shutdown: refusing new connections failed', error),
        );
      });
      await attempt('waiting for the running requests', () => waitForRequests(server));
      await attempt('closing the remaining connections', () =>
        Promise.race([Promise.resolve(server.stop(true)), sleep(1000)]),
      );
    }

    await attempt('writing what was pending', async () => {
      const { drained, remaining } = await dependencies.drainBackground(backgroundGraceMs);
      if (!drained) log.warn(`Shutdown: ${remaining} background write(s) did not finish in time.`);
    });
    await attempt('closing the database', () =>
      Promise.race([dependencies.closeDatabase(), sleep(databaseCloseMs)]),
    );
    dependencies.exit(exitCode);
  };

  return {
    run(reason, exitCode = 0) {
      running ??= perform(reason, exitCode);
      return running;
    },
    onSignal(signal) {
      if (running) {
        log.warn(`Shutdown: ${signal} again - ending the process now.`);
        dependencies.exit(1);
        return;
      }
      void this.run(signal);
    },
    get isShuttingDown() {
      return running !== null;
    },
  };
}

/**
 * Wires the shutdown to the process: the signals that mean "stop" (`SIGBREAK` is what a Windows console
 * sends when it is closed), and the failures nothing caught - an exception leaves the process in a state
 * nobody can vouch for, so it stops in order instead of limping on; a rejected promise nobody awaited is
 * only logged, since it says nothing about the rest of the server.
 */
export function installShutdownHandlers(
  shutdown: Shutdown,
  log: Pick<ShutdownDependencies['log'], 'error'>,
  target: Pick<NodeJS.Process, 'on' | 'platform'> = process,
): void {
  const signals = [
    'SIGINT',
    'SIGTERM',
    'SIGHUP',
    ...(target.platform === 'win32' ? ['SIGBREAK'] : []),
  ];
  for (const signal of signals) {
    target.on(signal as NodeJS.Signals, () => shutdown.onSignal(signal));
  }
  target.on('uncaughtException', (error) => {
    log.error('Uncaught exception', error);
    void shutdown.run('uncaught exception', 1);
  });
  target.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', reason);
  });
}
