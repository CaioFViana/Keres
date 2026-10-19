import type { Dirent } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { VerificationConfig } from '../config';
import { DAY_MS, ownedEntryTime, STALE_TEMP_MS, TEMP_PREFIX } from './layout';

/**
 * Deletes the backups older than `BACKUP_RETENTION_DAYS`, and the temporary folders of runs that stopped halfway once they
 * are a day old (they hold the plain snapshot, so they are not kept for the whole retention). It looks only at the direct
 * entries of `BACKUP_DIR` whose names are ours: anything else in the folder, a file a person put there, is left alone.
 * Age comes from the stamp in the name, so the rule is the same on every file system and in every test.
 *
 * Runs even when the backup of the same round failed: old copies must age out regardless.
 */
export async function rotateBackups(config: VerificationConfig, now: number): Promise<string[]> {
  if (config.backupDir === undefined) return [];
  const cutoff = now - config.backupRetentionDays * DAY_MS;
  const staleTempCutoff = now - STALE_TEMP_MS;

  let entries: Dirent[];
  try {
    entries = await readdir(config.backupDir, { withFileTypes: true });
  } catch (error) {
    // No backup folder yet means nothing to rotate.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }

  const removed: string[] = [];
  for (const entry of entries) {
    // Directories only: a symbolic link or a file that happens to carry our name is never followed or removed.
    if (!entry.isDirectory()) continue;
    const madeAt = ownedEntryTime(entry.name);
    if (madeAt === undefined) continue;
    const limit = entry.name.startsWith(TEMP_PREFIX) ? staleTempCutoff : cutoff;
    if (madeAt >= limit) continue;
    await rm(join(config.backupDir, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}
