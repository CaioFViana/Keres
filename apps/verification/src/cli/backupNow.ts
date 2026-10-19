import { ConfigError, loadConfig } from '../config';
import { errorLabel } from '../backup/layout';
import { expireMonthlies, keepMonthlyCopy, rotateMonthlies } from '../backup/monthly';
import { rotateBackups } from '../backup/rotateBackups';
import { takeBackup, type BackupResult } from '../backup/takeBackup';

/**
 * `bun run backup:now` takes one backup, then the monthly time limit, then the monthly copy (only when the backup succeeded)
 * and its rotation, then the daily rotation,
 * with the configuration of the service (run it where the service runs, e.g. `docker compose exec verification bun run
 * backup:now`). The service keeps running; the snapshot is taken from the live database, as the timer does.
 *
 * Restoring is not done here: stop the service, then follow "Backups" in apps/verification/README.md.
 */
export async function runBackupNow(env: NodeJS.ProcessEnv): Promise<number> {
  let config;
  try {
    config = loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      for (const problem of error.problems) console.error(`ERROR: ${problem}`);
    } else {
      console.error(errorLabel(error));
    }
    return 1;
  }
  if (config.backupDir === undefined) {
    console.error('ERROR: BACKUP_DIR is not set: there is nowhere to write a backup.');
    return 1;
  }

  const now = Date.now();
  let failed = false;
  let backup: BackupResult | undefined;
  try {
    backup = await takeBackup(config, now);
    console.log(`Backup written: ${backup.folder} (${backup.blobsCopied} image file(s)).`);
  } catch (error) {
    console.error(`Backup failed: ${errorLabel(error)}.`);
    failed = true;
  }
  // The 93-day limit applies whether or not this backup succeeded, as in the timer.
  try {
    const expired = await expireMonthlies(config, now);
    console.log(`Removed ${expired.length} monthly copy(ies) older than the limit.`);
  } catch (error) {
    console.error(`Monthly expiry failed: ${errorLabel(error)}.`);
    failed = true;
  }
  if (backup !== undefined) {
    try {
      const monthly = await keepMonthlyCopy(config, now, backup.folder);
      if (monthly !== undefined) console.log(`Monthly copy kept: ${monthly}.`);
    } catch (error) {
      console.error(`Monthly copy failed: ${errorLabel(error)}.`);
      failed = true;
    }
    try {
      const removed = await rotateMonthlies(config);
      console.log(
        `Rotated out ${removed.length} monthly copy(ies), keeping the newest ${config.backupMonthlyKeep}.`,
      );
    } catch (error) {
      console.error(`Monthly rotation failed: ${errorLabel(error)}.`);
      failed = true;
    }
  }
  try {
    const removed = await rotateBackups(config, now);
    console.log(
      `Rotated out ${removed.length} backup entr${removed.length === 1 ? 'y' : 'ies'} older than ${config.backupRetentionDays} day(s).`,
    );
  } catch (error) {
    console.error(`Backup rotation failed: ${errorLabel(error)}.`);
    failed = true;
  }
  return failed ? 1 : 0;
}

if (import.meta.main) {
  process.exitCode = await runBackupNow(process.env);
}
