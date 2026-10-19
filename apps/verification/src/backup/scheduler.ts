import type { VerificationConfig } from '../config';
import { rotateBackups } from './rotateBackups';
import { expireMonthlies, keepMonthlyCopy, rotateMonthlies } from './monthly';
import { takeBackup, type BackupResult } from './takeBackup';
import { errorLabel, HOUR_MS } from './layout';

/**
 * The backup timer of the service, the same shape as the outbox timer: started at boot, one round at a time, stopped on
 * shutdown after a round in progress has finished. A round is a backup, then the monthly time limit (after every round),
 * then the monthly copy and its count rotation (only when the backup succeeded), then the daily rotation. A failure in any step is logged by its label (a code or a fixed message,
 * never the text of an error that might carry a name or a path) and never stops the service.
 */

/** The first round runs shortly after boot, so a fresh deployment gets a copy without waiting a whole interval. */
export const FIRST_BACKUP_DELAY_MS = 60 * 1000;

export interface BackupDeps {
  takeBackup: (config: VerificationConfig, now: number) => Promise<BackupResult>;
  keepMonthlyCopy: (
    config: VerificationConfig,
    now: number,
    dailyFolder: string,
  ) => Promise<string | undefined>;
  rotateMonthlies: (config: VerificationConfig) => Promise<string[]>;
  expireMonthlies: (config: VerificationConfig, now: number) => Promise<string[]>;
  rotateBackups: (config: VerificationConfig, now: number) => Promise<string[]>;
}

const DEFAULT_DEPS: BackupDeps = {
  takeBackup,
  keepMonthlyCopy,
  rotateMonthlies,
  expireMonthlies,
  rotateBackups,
};

/** One round at `now`: a backup, the monthly step, then the daily rotation. No step's failure is thrown. */
export async function runBackupRound(
  config: VerificationConfig,
  now: number,
  deps: BackupDeps = DEFAULT_DEPS,
): Promise<void> {
  let backup: BackupResult | undefined;
  try {
    backup = await deps.takeBackup(config, now);
    console.log(
      `Backup written: ${backup.name} (${backup.blobsCopied} image file(s), ${backup.blobsGone} gone meanwhile).`,
    );
  } catch (error) {
    console.error(`Backup failed: ${errorLabel(error)}. The older backups are kept.`);
  }
  // The time limit on monthly copies applies after every round, failed or not: an outage must not keep one past it.
  try {
    const expired = await deps.expireMonthlies(config, now);
    if (expired.length > 0) {
      console.log(`Removed ${expired.length} monthly copy(ies) older than the limit.`);
    }
  } catch (error) {
    console.error(`Monthly expiry failed: ${errorLabel(error)}.`);
  }
  // Creating a monthly copy, and the count rule, follow a successful daily only.
  if (backup !== undefined) {
    try {
      const monthly = await deps.keepMonthlyCopy(config, now, backup.folder);
      if (monthly !== undefined) console.log(`Monthly copy kept: ${monthly}.`);
    } catch (error) {
      console.error(`Monthly copy failed: ${errorLabel(error)}. The daily backup is kept.`);
    }
    try {
      const removed = await deps.rotateMonthlies(config);
      if (removed.length > 0) {
        console.log(
          `Rotated out ${removed.length} monthly copy(ies), keeping the newest ${config.backupMonthlyKeep}.`,
        );
      }
    } catch (error) {
      console.error(`Monthly rotation failed: ${errorLabel(error)}.`);
    }
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
