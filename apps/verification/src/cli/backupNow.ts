import { ConfigError, loadConfig } from '../config';
import { errorLabel } from '../backup/layout';
import { rotateBackups } from '../backup/rotateBackups';
import { takeBackup } from '../backup/takeBackup';

/**
 * `bun run backup:now` takes one backup and then rotates, with the configuration of the service (run it where the service
 * runs, e.g. `docker compose exec verification bun run backup:now`). The service keeps running; the snapshot is taken
 * from the live database, as the timer does.
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
  try {
    const result = await takeBackup(config, now);
    console.log(`Backup written: ${result.folder} (${result.blobsCopied} image file(s)).`);
  } catch (error) {
    console.error(`Backup failed: ${errorLabel(error)}.`);
    failed = true;
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
