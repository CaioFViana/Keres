import { isAbortError, isOfflineError } from '../apiClient';

/** Normal cadence while the server is responding. */
export const SYNC_INTERVAL_MS = 30_000;
/** Fast cadence used while the configured server is unreachable. */
export const OFFLINE_RETRY_MS = 5_000;
/** Base delay for the backoff after a failed cycle; doubled per consecutive failure. */
export const FAILED_RETRY_BASE_MS = 30_000;
/** Upper bound for the backoff after repeated failed cycles. */
export const FAILED_RETRY_MAX_MS = 300_000;
/**
 * Upper bound for `stopAndWait` / `reset` so a hung HTTP cycle cannot block story
 * deactivation or context switches indefinitely. Aligns with the default HTTP timeout
 * plus a small margin for local bookkeeping after the request ends.
 */
export const STOP_AND_WAIT_TIMEOUT_MS = 45_000;
/** The doubling stops here: base × 2^4 already exceeds the cap. */
const FAILED_RETRY_MAX_SHIFT = 4;

/**
 * Outcome of one sync cycle, reported by the engine:
 * - 'ok': a useful cycle completed (even with conflicts or skipped items);
 * - 'offline': the server was unreachable;
 * - 'failed': an unexpected error or non-offline failure.
 */
export type SyncCycleOutcome = 'ok' | 'offline' | 'failed';

/**
 * Exponential backoff for consecutive 'failed' cycles: base × 2^min(fails, 4), capped at
 * 5min, with ±25% jitter so a fleet of clients does not retry in lockstep.
 */
export function failedRetryDelayMs(
  consecutiveFailures: number,
  random: () => number = Math.random,
): number {
  const shift = Math.min(Math.max(consecutiveFailures, 1), FAILED_RETRY_MAX_SHIFT);
  const capped = Math.min(FAILED_RETRY_BASE_MS * 2 ** shift, FAILED_RETRY_MAX_MS);
  return Math.round(capped * (0.75 + random() * 0.5));
}

interface SyncReadiness {
  storyId: string | null;
  hasServer: boolean;
  hasDatabase: boolean;
}

interface SyncSchedulerOptions {
  readiness: () => SyncReadiness;
  /** Receives the cycle AbortSignal; aborted when `stop` / `stopAndWait` runs. */
  performSync: (signal: AbortSignal) => Promise<SyncCycleOutcome>;
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
  private consecutiveFailures = 0;
  private cycleAbort: AbortController | null = null;

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
    this.consecutiveFailures = 0;
    this.suspended = false;
    this.running = true;
    this.generation += 1;
    const generation = this.generation;

    const runCycle = async () => {
      let outcome: SyncCycleOutcome = 'ok';
      try {
        outcome = await this.runExclusive();
      } catch (error) {
        if (isAbortError(error)) {
          console.log('SyncEngineService: sync cycle aborted.');
        } else if (isOfflineError(error)) {
          console.log('SyncEngineService: sync cycle skipped, server unreachable.');
          outcome = 'offline';
        } else {
          console.error('SyncEngineService: Unexpected error during sync cycle.', error);
          outcome = 'failed';
        }
      }

      if (!this.running || this.generation !== generation) return;
      this.timer = setTimeout(runCycle, this.delayForOutcome(outcome));
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
    this.cycleAbort?.abort();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('Sync engine stopped.');
    }
  }

  /**
   * Stops accepting work and resolves after the active cycle finishes, or after
   * `timeoutMs` so a hung request cannot block context switches forever.
   *
   * Returns `'timed_out'` when the cycle is still running: the caller must keep that
   * cycle bound to its original story/server so a later context change cannot mix work.
   * Generation bumping already prevents it from scheduling further work.
   */
  public async stopAndWait(
    timeoutMs: number = STOP_AND_WAIT_TIMEOUT_MS,
  ): Promise<'idle' | 'timed_out'> {
    this.stop();
    return this.waitForIdle(timeoutMs);
  }

  /** Allows explicit requests again after the owning context has been configured. */
  public resume(): void {
    this.suspended = false;
  }

  /** Drops the failure streak; a new story context must not inherit the old backoff. */
  public resetBackoff(): void {
    this.consecutiveFailures = 0;
  }

  public async reset(): Promise<void> {
    await this.stopAndWait();
  }

  /**
   * Next delay for a timer-driven cycle. 'ok' restores the healthy cadence and clears the
   * failure streak; 'failed' escalates the backoff; 'offline' keeps the fast retry without
   * touching the streak (unreachability is not a server failure).
   */
  private delayForOutcome(outcome: SyncCycleOutcome): number {
    if (outcome === 'offline') return OFFLINE_RETRY_MS;
    if (outcome === 'failed') {
      this.consecutiveFailures += 1;
      return failedRetryDelayMs(this.consecutiveFailures);
    }
    this.consecutiveFailures = 0;
    return this.intervalTimeMs;
  }

  /**
   * Runs one cycle (plus a coalesced follow-up when requested mid-flight) and reports the
   * outcome of the last cycle executed. 'ok' when nothing ran (suspended/stopped/aborted):
   * no work means no failure signal, so the chain stays on the healthy cadence.
   */
  private async runExclusive(): Promise<SyncCycleOutcome> {
    if (this.inFlight) {
      // A stopped/suspended scheduler must not coalesce follow-up work onto the abandoned cycle.
      if (!this.suspended) this.queued = true;
      return 'ok';
    }
    this.inFlight = true;
    const generation = this.generation;
    const abort = new AbortController();
    this.cycleAbort = abort;
    try {
      let outcome: SyncCycleOutcome = 'ok';
      do {
        this.queued = false;
        if (abort.signal.aborted || this.suspended || this.generation !== generation) {
          break;
        }
        outcome = await this.options.performSync(abort.signal);
      } while (this.queued && this.generation === generation && !this.suspended);
      return outcome;
    } finally {
      if (this.cycleAbort === abort) this.cycleAbort = null;
      this.inFlight = false;
      for (const resolve of this.idleResolvers) resolve();
      this.idleResolvers.clear();
    }
  }

  private async waitForIdle(timeoutMs: number): Promise<'idle' | 'timed_out'> {
    if (!this.inFlight) return 'idle';
    return new Promise<'idle' | 'timed_out'>((resolve) => {
      let settled = false;
      const finish = (result: 'idle' | 'timed_out') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.idleResolvers.delete(onIdle);
        resolve(result);
      };
      const onIdle = () => finish('idle');
      const timer = setTimeout(() => finish('timed_out'), timeoutMs);
      this.idleResolvers.add(onIdle);
    });
  }
}
