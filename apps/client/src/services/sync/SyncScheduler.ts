import { isOfflineError } from '../apiClient';

/** Normal cadence while the server is responding. */
export const SYNC_INTERVAL_MS = 30_000;
/** Fast cadence used while the configured server is unreachable. */
export const OFFLINE_RETRY_MS = 5_000;
/**
 * Upper bound for `stopAndWait` / `reset` so a hung HTTP cycle cannot block story
 * deactivation or context switches indefinitely. Aligns with the default HTTP timeout
 * plus a small margin for local bookkeeping after the request ends.
 */
export const STOP_AND_WAIT_TIMEOUT_MS = 45_000;

interface SyncReadiness {
  storyId: string | null;
  hasServer: boolean;
  hasDatabase: boolean;
}

interface SyncSchedulerOptions {
  readiness: () => SyncReadiness;
  performSync: () => Promise<boolean>;
}

/** Owns cycle scheduling and guarantees that timer and on-demand cycles never overlap. */
export class SyncScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;
  private queued = false;
  private idleResolvers = new Set<() => void>();
  private generation = 0;
  private suspended = false;
  private intervalTimeMs = SYNC_INTERVAL_MS;

  public constructor(private readonly options: SyncSchedulerOptions) {}

  public get isRunning(): boolean {
    return this.running;
  }

  public start(intervalTimeMs?: number): void {
    if (this.running) {
      console.log('Sync engine already running.');
      return;
    }

    const readiness = this.options.readiness();
    if (!readiness.storyId) {
      console.log('Cannot start sync: storyId is not set. Activate a story first.');
      return;
    }
    if (!readiness.hasServer) {
      console.log(
        'Cannot start sync: server URL is not set. Activate a story with a valid server.',
      );
      return;
    }
    if (!readiness.hasDatabase) {
      console.log('Cannot start sync: Drizzle client (db) is not bound.');
      return;
    }

    this.intervalTimeMs = intervalTimeMs || this.intervalTimeMs;
    this.suspended = false;
    this.running = true;
    this.generation += 1;
    const generation = this.generation;

    const runCycle = async () => {
      let wasOffline = false;
      try {
        wasOffline = await this.runExclusive();
      } catch (error) {
        if (isOfflineError(error)) {
          console.log('SyncEngineService: sync cycle skipped, server unreachable.');
          wasOffline = true;
        } else {
          console.error('SyncEngineService: Unexpected error during sync cycle.', error);
        }
      }

      if (!this.running || this.generation !== generation) return;
      this.timer = setTimeout(runCycle, wasOffline ? OFFLINE_RETRY_MS : this.intervalTimeMs);
    };

    void runCycle();
  }

  public request(): void {
    if (this.suspended) return;
    const readiness = this.options.readiness();
    if (!readiness.storyId || !readiness.hasDatabase || !readiness.hasServer) return;
    void this.runExclusive().catch((error) => {
      console.log('SyncEngineService: on-demand sync failed.', error);
    });
  }

  public stop(): void {
    this.suspended = true;
    this.running = false;
    this.generation += 1;
    this.queued = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('Sync engine stopped.');
    }
  }

  /**
   * Stops accepting work and resolves after the active cycle finishes, or after
   * `timeoutMs` so a hung request cannot block context switches forever.
   * The in-flight cycle may still complete in the background; generation bumping
   * already prevents it from scheduling further work.
   */
  public async stopAndWait(timeoutMs: number = STOP_AND_WAIT_TIMEOUT_MS): Promise<void> {
    this.stop();
    await this.waitForIdle(timeoutMs);
  }

  /** Allows explicit requests again after the owning context has been configured. */
  public resume(): void {
    this.suspended = false;
  }

  public async reset(): Promise<void> {
    await this.stopAndWait();
  }

  private async runExclusive(): Promise<boolean> {
    if (this.inFlight) {
      this.queued = true;
      return false;
    }
    this.inFlight = true;
    try {
      let wasOffline = false;
      do {
        this.queued = false;
        wasOffline = await this.options.performSync();
      } while (this.queued);
      return wasOffline;
    } finally {
      this.inFlight = false;
      for (const resolve of this.idleResolvers) resolve();
      this.idleResolvers.clear();
    }
  }

  private async waitForIdle(timeoutMs: number = STOP_AND_WAIT_TIMEOUT_MS): Promise<void> {
    if (!this.inFlight) return;
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.idleResolvers.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.idleResolvers.add(finish);
    });
  }
}
