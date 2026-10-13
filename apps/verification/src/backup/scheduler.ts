import type { VerificationConfig } from '../config';
import { rotateBackups } from './rotateBackups';
import { takeBackup, type BackupResult } from './takeBackup';
import { errorLabel, HOUR_MS } from './layout';

/**
 * The backup timer of the service, the same shape as the outbox timer: started at boot, one round at a time, stopped on
 * shutdown after a round in progress has finished. A round is a backup and then a rotation; a failure in either is
 * logged by its label (a code or a fixed message, never the text of an error that might carry a name or a path) and
 * never stops the service.
 */

/** The first round runs shortly after boot, so a fresh deployment gets a copy without waiting a whole interval. */
export const FIRST_BACKUP_DELAY_MS = 60 * 1000;

export interface BackupDeps {
  takeBackup: (config: VerificationConfig, now: number) => Promise<BackupResult>;
  rotateBackups: (config: VerificationConfig, now: number) => Promise<string[]>;
}

const DEFAULT_DEPS: BackupDeps = { takeBackup, rotateBackups };

/** One round at `now`: a backup, then the rotation. Both are attempted; neither failure is thrown. */
export async function runBackupRound(
  config: VerificationConfig,
  now: number,
  deps: BackupDeps = DEFAULT_DEPS,
): Promise<void> {
  try {
    const result = await deps.takeBackup(config, now);
    console.log(
      `Backup written: ${result.name} (${result.blobsCopied} image file(s), ${result.blobsGone} gone meanwhile).`,
    );
  } catch (error) {
    console.error(`Backup failed: ${errorLabel(error)}. The older backups are kept.`);
  }
  try {
    const removed = await deps.rotateBackups(config, now);
    if (removed.length > 0) {
      console.log(
        `Rotated out ${removed.length} backup entr${removed.length === 1 ? 'y' : 'ies'} older than ${config.backupRetentionDays} day(s).`,
      );
    }
  } catch (error) {
    console.error(`Backup rotation failed: ${errorLabel(error)}.`);
  }
}

export interface BackupScheduler {
  /** Runs a round now, unless one is in progress already (then it resolves with that one). */
  runNow(): Promise<void>;
  /** Stops the timer and waits for a round in progress to finish. */
  stop(): Promise<void>;
}

export interface BackupSchedulerOptions {
  firstDelayMs?: number;
  intervalMs?: number;
  clock?: () => number;
  /** Replaces the round; the default is `runBackupRound` with the real backup and rotation. */
  round?: (now: number) => Promise<void>;
}

/** Starts the timer: the first round after `FIRST_BACKUP_DELAY_MS`, then one every `BACKUP_INTERVAL_HOURS`. */
export function startBackupScheduler(
  config: VerificationConfig,
  options: BackupSchedulerOptions = {},
): BackupScheduler {
  const intervalMs = options.intervalMs ?? config.backupIntervalHours * HOUR_MS;
  const clock = options.clock ?? Date.now;
  const round = options.round ?? ((now: number) => runBackupRound(config, now));

  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let stopped = false;

  const runOnce = (): Promise<void> => {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          await round(clock());
        } catch (error) {
          // A round is not expected to throw; if a replacement does, the timer still goes on.
          console.error(`Backup round failed: ${errorLabel(error)}.`);
        } finally {
          inFlight = undefined;
        }
      })();
    }
    return inFlight;
  };

  const schedule = (delayMs: number): void => {
    if (stopped) return;
    timer = setTimeout(() => {
      timer = undefined;
      void runOnce().then(() => schedule(intervalMs));
    }, delayMs);
  };
  schedule(options.firstDelayMs ?? FIRST_BACKUP_DELAY_MS);

  return {
    runNow: runOnce,
    async stop(): Promise<void> {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      await inFlight;
    },
  };
}
