import { gunzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerificationConfig } from '../src/config';
import { BackupError, BLOBS_DIR, monthlyNameFor, SNAPSHOT_FILE } from '../src/backup/layout';
import { expireMonthlies, keepMonthlyCopy, rotateMonthlies } from '../src/backup/monthly';
import { rotateBackups } from '../src/backup/rotateBackups';
import { runBackupRound } from '../src/backup/scheduler';
import { takeBackup } from '../src/backup/takeBackup';
import { storeBlob } from '../src/store/blobs';
import { startVerification } from '../src/verifications';
import { harness, type Harness, T0 } from './helpers/harness';

/**
 * The monthly copies: one per calendar month, made from the first successful daily backup of that month, kept as the
 * newest `BACKUP_MONTHLY_KEEP`, and removed only by the monthly rotation. The daily rotation and a failed run never touch
 * them. The tests run the real backup, the real copy and the real rotation on a real (temporary) data store.
 */

const PLAIN = Buffer.from('a pretend image body for the monthly copy 0123456789');
const at = (iso: string): number => Date.parse(iso);

let h: Harness;
let config: VerificationConfig;
let backupDir: string;

beforeEach(() => {
  h = harness();
  backupDir = join(h.root, 'backups');
  config = { ...h.config, backupDir };
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  h.close();
});

/** The entries directly under the backup folder, sorted. */
function entries(): string[] {
  return existsSync(backupDir) ? readdirSync(backupDir).sort() : [];
}

/** A folder with one file in it, standing for an old copy. */
function folder(name: string): void {
  mkdirSync(join(backupDir, name), { recursive: true });
  writeFileSync(join(backupDir, name, SNAPSHOT_FILE), 'ciphertext-and-metadata');
}

/** One round with the real steps, the backup failing when `fail` is set. */
async function round(now: number, fail = false): Promise<void> {
  await runBackupRound(config, now, {
    takeBackup: fail
      ? async () => {
          throw new BackupError('simulated failure');
        }
      : takeBackup,
    keepMonthlyCopy,
    rotateMonthlies,
    expireMonthlies,
    rotateBackups,
  });
}

describe('monthly copies: the 93-day limit', () => {
  it('an outage from the first of the month: its copy goes once the month began more than 93 days ago, with no success at all', async () => {
    folder('verification-monthly-202607');

    // 1 July to 1 October 12:00 UTC is 92.5 days: still inside the limit, through a run that fails.
    await round(at('2026-10-01T12:00:00Z'), true);
    expect(entries()).toEqual(['verification-monthly-202607']);

    // 2 October 12:00 UTC is past 93 days from 1 July: removed, and the failed run created nothing.
    await round(at('2026-10-02T12:00:00Z'), true);
    expect(entries()).toEqual([]);
  });

  it('the limit is strict: exactly 93 days from the first of the month is kept, one second later is removed', async () => {
    folder('verification-monthly-202607');

    expect(await expireMonthlies(config, at('2026-10-02T00:00:00Z'))).toEqual([]);
    expect(await expireMonthlies(config, at('2026-10-02T00:00:01Z'))).toEqual([
      'verification-monthly-202607',
    ]);
  });

  it('removes only the monthly copies past the limit: the current month and the one before are never expired', async () => {
    folder('verification-monthly-202607');
    folder('verification-monthly-202608');
    folder('verification-monthly-202610');
    folder('verification-20261020T120000Z'); // a daily: never a monthly concern

    expect(await expireMonthlies(config, at('2026-10-20T12:00:00Z'))).toEqual([
      'verification-monthly-202607',
    ]);
    expect(entries()).toEqual([
      'verification-20261020T120000Z',
      'verification-monthly-202608',
      'verification-monthly-202610',
    ]);
  });

  it('a failed run applies the count rule to nothing: only the time limit acts on a failed round', async () => {
    config = { ...config, backupMonthlyKeep: 1 };
    folder('verification-monthly-202609');
    folder('verification-monthly-202610');

    // A failed run: nothing is in the limit yet, and the count rule does not run.
    await round(at('2026-10-05T12:00:00Z'), true);
    expect(entries()).toEqual(['verification-monthly-202609', 'verification-monthly-202610']);
  });
});

describe('monthly copies: when they are made', () => {
  it('makes one monthly copy on the first successful backup of a month, and none after it that month', async () => {
    await round(at('2026-10-03T12:00:00Z'));
    expect(entries()).toEqual(['verification-20261003T120000Z', 'verification-monthly-202610']);

    await round(at('2026-10-04T12:00:00Z'));
    await round(at('2026-10-20T12:00:00Z'));
    expect(entries().filter((name) => name.startsWith('verification-monthly-'))).toEqual([
      'verification-monthly-202610',
    ]);
    expect(entries().filter((name) => name.startsWith('verification-2026'))).toHaveLength(3);
  });

  it('a failed run creates no monthly copy, and the first success of that month still does', async () => {
    await round(at('2026-11-01T12:00:00Z'), true);
    expect(entries().filter((name) => name.includes('monthly'))).toEqual([]);

    await round(at('2026-11-02T12:00:00Z'));
    expect(entries()).toContain('verification-monthly-202611');
  });

  it('a failed run deletes no monthly copy, even one the rotation would trim', async () => {
    config = { ...config, backupMonthlyKeep: 1 };
    folder('verification-monthly-202608');
    folder('verification-monthly-202609');
    folder('verification-monthly-202610');

    await round(at('2026-11-01T12:00:00Z'), true);
    expect(entries().filter((name) => name.startsWith('verification-monthly-'))).toHaveLength(3);

    // The same setup with a successful run trims them to the newest one: the test is not vacuous.
    await round(at('2026-11-02T12:00:00Z'));
    expect(entries().filter((name) => name.startsWith('verification-monthly-'))).toEqual([
      'verification-monthly-202611',
    ]);
  });

  it('with BACKUP_MONTHLY_KEEP=0 no monthly copy is made', async () => {
    const none = { ...config, backupMonthlyKeep: 0 };
    await runBackupRound(none, at('2026-10-03T12:00:00Z'), {
      takeBackup,
      keepMonthlyCopy,
      rotateMonthlies,
      expireMonthlies,
      rotateBackups,
    });
    expect(entries().filter((name) => name.includes('monthly'))).toEqual([]);
    expect(entries()).toHaveLength(1);
  });

  it('a monthly copy is copied from the finished daily folder, byte for byte, and keeps no link to the live blobs', async () => {
    const id = startVerification(h.state, {
      verificationId: 'v-monthly',
      subject: { userId: 'user-monthly', username: 'ana' },
      language: 'pt-BR',
    }).row.id;
    const meta = storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });

    await round(at('2026-10-03T12:00:00Z'));
    const daily = join(backupDir, 'verification-20261003T120000Z');
    const monthly = join(backupDir, monthlyNameFor(at('2026-10-03T12:00:00Z')));

    expect(readdirSync(monthly).sort()).toEqual([BLOBS_DIR, SNAPSHOT_FILE].sort());
    const copy = join(monthly, BLOBS_DIR, meta.fileName);
    expect(readFileSync(copy).equals(readFileSync(join(daily, BLOBS_DIR, meta.fileName)))).toBe(
      true,
    );
    // A hard link would report more than one name for the file; a copy has exactly one.
    expect(statSync(copy).nlink).toBe(1);
    expect(readFileSync(copy).includes(PLAIN)).toBe(false);

    // The copy stands on its own: the daily it came from can go, and the snapshot still opens.
    await rm(daily, { recursive: true, force: true });
    expect(gunzipSync(readFileSync(join(monthly, SNAPSHOT_FILE))).length).toBeGreaterThan(0);
  });

  it('an interrupted monthly copy leaves no monthly folder and no temporary folder behind', async () => {
    mkdirSync(backupDir, { recursive: true });
    await expect(
      keepMonthlyCopy(config, at('2026-10-03T12:00:00Z'), join(backupDir, 'verification-missing')),
    ).rejects.toThrow();
    expect(entries()).toEqual([]);
  });

  it('a daily backup that succeeded is kept even when its monthly copy fails', async () => {
    await runBackupRound(config, at('2026-10-03T12:00:00Z'), {
      takeBackup,
      keepMonthlyCopy: async () => {
        throw new Error('EIO');
      },
      rotateMonthlies,
      expireMonthlies,
      rotateBackups,
    });
    expect(entries()).toEqual(['verification-20261003T120000Z']);
  });
});

describe('monthly copies: rotation', () => {
  it('keeps the newest 3 monthly copies and removes the older ones', async () => {
    for (const month of ['202601', '202602', '202603', '202604', '202605', '202606']) {
      folder(`verification-monthly-${month}`);
    }

    const removed = await rotateMonthlies(config);

    expect(removed.sort()).toEqual([
      'verification-monthly-202601',
      'verification-monthly-202602',
      'verification-monthly-202603',
    ]);
    expect(entries()).toEqual([
      'verification-monthly-202604',
      'verification-monthly-202605',
      'verification-monthly-202606',
    ]);
  });

  it('with BACKUP_MONTHLY_KEEP=1 keeps only the newest; with 0 it removes every monthly copy', async () => {
    folder('verification-monthly-202608');
    folder('verification-monthly-202609');
    folder('verification-monthly-202610');

    expect(await rotateMonthlies({ ...config, backupMonthlyKeep: 1 })).toHaveLength(2);
    expect(entries()).toEqual(['verification-monthly-202610']);

    expect(await rotateMonthlies({ ...config, backupMonthlyKeep: 0 })).toEqual([
      'verification-monthly-202610',
    ]);
    expect(entries()).toEqual([]);
  });

  it('removes only folders named like a monthly copy: files, near misses and daily copies are left alone', async () => {
    folder('verification-monthly-202601');
    folder('verification-monthly-202602');
    folder('verification-monthly-202603');
    folder('verification-monthly-202604');
    folder('verification-monthly-202613'); // not a month
    folder('verification-monthly-202601.bak'); // a near miss
    folder('verification-monthly-2026-01'); // another shape
    writeFileSync(join(backupDir, 'verification-monthly-202599'), 'a file with our name');
    folder('verification-20260101T000000Z'); // a daily copy

    await rotateMonthlies(config);

    expect(entries()).toEqual(
      [
        'verification-20260101T000000Z',
        'verification-monthly-202599',
        'verification-monthly-202601.bak',
        'verification-monthly-202602',
        'verification-monthly-202603',
        'verification-monthly-202604',
        'verification-monthly-202613',
        'verification-monthly-2026-01',
      ].sort(),
    );
  });

  it('the daily rotation removes no monthly copy, however old it is', async () => {
    folder('verification-monthly-202501');
    folder('verification-20250101T000000Z'); // a daily copy of the same age: removed

    const removed = await rotateBackups(config, T0);

    expect(removed).toEqual(['verification-20250101T000000Z']);
    expect(entries()).toEqual(['verification-monthly-202501']);
  });
});

describe('monthly copies: names and the calendar', () => {
  it('names a copy by the UTC month, so the last second of a month and the first of the next differ', () => {
    expect(monthlyNameFor(at('2026-12-31T23:59:59Z'))).toBe('verification-monthly-202612');
    expect(monthlyNameFor(at('2027-01-01T00:00:00Z'))).toBe('verification-monthly-202701');
    expect(monthlyNameFor(T0)).toBe('verification-monthly-202610');
  });

  it('the daily retention removes a daily copy of 31 days and keeps the monthly copy of its month', async () => {
    folder('verification-20260831T120000Z');
    folder('verification-monthly-202608');

    // 30 days old is still inside the 30-day retention; 31 days is out.
    expect(await rotateBackups(config, at('2026-09-30T12:00:00Z'))).toEqual([]);
    expect(await rotateBackups(config, at('2026-10-01T12:00:00Z'))).toEqual([
      'verification-20260831T120000Z',
    ]);
    expect(entries()).toEqual(['verification-monthly-202608']);
  });
});
