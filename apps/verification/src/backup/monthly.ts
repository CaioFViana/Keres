import { randomBytes } from 'node:crypto';
import { type Dirent, existsSync } from 'node:fs';
import { cp, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { VerificationConfig } from '../config';
import {
  DAY_MS,
  MONTHLY_MAX_AGE_DAYS,
  monthlyNameFor,
  monthOfMonthly,
  monthStartOf,
  stampOf,
  TEMP_PREFIX,
} from './layout';

/**
 * The monthly copies: the first successful backup of each calendar month (UTC) is also kept as
 * `BACKUP_DIR/verification-monthly-YYYYMM/`, a copy of the finished daily folder. The newest `BACKUP_MONTHLY_KEEP` are kept;
 * older ones are removed here, and never by the daily rotation. The daily rotation never removes a monthly either.
 *
 * The copy is made of bytes, not of hard links. The live blob files are overwritten and then deleted when a decision is
 * made, and a hard link would then be zeroed along with them. The copy is written under a temporary name and renamed when
 * complete, so an interrupted copy never leaves a monthly folder that looks whole.
 */

/**
 * Copies the finished daily folder into the slot of its month, unless that month already has a monthly copy or monthly
 * copies are off (`BACKUP_MONTHLY_KEEP=0`). Returns the name of the new copy, or `undefined` when none was made. The caller
 * calls this only after the daily backup succeeded, so a failed run never creates a monthly copy.
 */
export async function keepMonthlyCopy(
  config: VerificationConfig,
  now: number,
  dailyFolder: string,
): Promise<string | undefined> {
  if (config.backupDir === undefined || config.backupMonthlyKeep === 0) return undefined;
  const name = monthlyNameFor(now);
  const target = join(config.backupDir, name);
  if (existsSync(target)) return undefined;

  // The temporary folder has the daily kind of name, so a copy cut short by a power cut is removed by the daily rotation
  // once it is a day old, like any other interrupted backup.
  const temporary = join(
    config.backupDir,
    `${TEMP_PREFIX}${stampOf(now)}-${randomBytes(4).toString('hex')}`,
  );
  try {
    await cp(dailyFolder, temporary, { recursive: true, errorOnExist: true, force: false });
    await rename(temporary, target);
    return name;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Keeps the newest `BACKUP_MONTHLY_KEEP` monthly copies and removes the rest. Months compare as `YYYYMM` text, which is
 * calendar order. With `BACKUP_MONTHLY_KEEP=0` every monthly copy is removed. Only directories named like ours are
 * considered; a file or a folder a person put there is left alone. Runs after a successful backup only.
 */
export async function rotateMonthlies(config: VerificationConfig): Promise<string[]> {
  const removed: string[] = [];
  for (const old of (await listMonthlies(config)).slice(config.backupMonthlyKeep)) {
    await rm(join(config.backupDir ?? '', old.name), { recursive: true, force: true });
    removed.push(old.name);
  }
  return removed;
}

/**
 * Removes the monthly copies whose month began more than `MONTHLY_MAX_AGE_DAYS` ago. Unlike the count rule this runs after
 * every round, failed or not: an outage must not keep a monthly copy past the limit. It creates nothing.
 */
export async function expireMonthlies(config: VerificationConfig, now: number): Promise<string[]> {
  const cutoff = now - MONTHLY_MAX_AGE_DAYS * DAY_MS;
  const removed: string[] = [];
  for (const old of await listMonthlies(config)) {
    if (monthStartOf(old.month) >= cutoff) continue;
    await rm(join(config.backupDir ?? '', old.name), { recursive: true, force: true });
    removed.push(old.name);
  }
  return removed;
}

/** The monthly copies in the backup folder, newest month first. */
async function listMonthlies(
  config: VerificationConfig,
): Promise<{ name: string; month: string }[]> {
  if (config.backupDir === undefined) return [];

  let entries: Dirent[];
  try {
    entries = await readdir(config.backupDir, { withFileTypes: true });
  } catch (error) {
    // No backup folder yet means no monthly copies.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }

  const monthlies: { name: string; month: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const month = monthOfMonthly(entry.name);
    if (month !== undefined) monthlies.push({ name: entry.name, month });
  }
  return monthlies.sort((a, b) => b.month.localeCompare(a.month));
}
