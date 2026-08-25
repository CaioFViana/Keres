import { isOfflineError } from '../apiClient';

/** Normal cadence while the server is responding. */
export const SYNC_INTERVAL_MS = 30_000;
/** Fast cadence used while the configured server is unreachable. */
export const OFFLINE_RETRY_MS = 5_000;

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
  private activeOperations = 0;
  private idleResolvers = new Set<() => void>();
  private generation = 0;
  private intervalTimeMs = SYNC_INTERVAL_MS;

  public constructor(private readonly options: SyncSchedulerOptions) {}

  public start(intervalTimeMs?: number): void {
    if (this.running) {
      console.log('Sync engine already running.');
      return;
    }

    const readiness = this.options.readiness();
    if (!readiness.storyId) {
      console.log('Cannot start sync: storyId is not set. Call configure() first.');
      return;
    }
    if (!readiness.hasServer) {
      console.log(
        'Cannot start sync: server URL is not set. Call configure() with a valid serverUrl.',
      );
      return;
    }
    if (!readiness.hasDatabase) {
      console.log('Cannot start sync: Drizzle client (db) is not set. Call setDbInstance() first.');
      return;
    }

    this.intervalTimeMs = intervalTimeMs || this.intervalTimeMs;
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
    const readiness = this.options.readiness();
    if (!readiness.storyId || !readiness.hasDatabase || !readiness.hasServer) return;
    void this.runExclusive().catch((error) => {
      console.log('SyncEngineService: on-demand sync failed.', error);
    });
  }

  public stop(): void {
    this.running = false;
    this.generation += 1;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('Sync engine stopped.');
    }
  }

  public async reset(): Promise<void> {
    this.stop();
    this.queued = false;
    await this.waitForIdle();
    this.inFlight = false;
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
        wasOffline = await this.performTracked();
      } while (this.queued);
      return wasOffline;
    } finally {
      this.inFlight = false;
    }
  }

  private async performTracked(): Promise<boolean> {
    this.activeOperations += 1;
    try {
      return await this.options.performSync();
    } finally {
      this.activeOperations -= 1;
      if (this.activeOperations === 0) {
        for (const resolve of this.idleResolvers) resolve();
        this.idleResolvers.clear();
      }
    }
  }

  private async waitForIdle(): Promise<void> {
    if (this.activeOperations === 0) return;
    await new Promise<void>((resolve) => this.idleResolvers.add(resolve));
  }
}
