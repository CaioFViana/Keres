import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type VerificationConfig } from '../src/config';
import { rotateBackups } from '../src/backup/rotateBackups';
import { testEnv, T0 } from './helpers/harness';

/**
 * Rotation deletes our own old backups and nothing else. The folder holds a mix of entries that look like ours and entries
 * that do not; the test checks each name, not only the count.
 */

let root: string;
let backupDir: string;
let config: VerificationConfig;

function makeConfig(overrides: Record<string, string> = {}): VerificationConfig {
  const data = resolve(join(root, 'live', 'data'));
  const keys = resolve(join(root, 'live', 'keys'));
  return loadConfig({
    ...testEnv(data, keys),
    BACKUP_DIR: backupDir,
    ...overrides,
  } as NodeJS.ProcessEnv);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'keres-backup-rotation-'));
  backupDir = join(root, 'backups');
  mkdirSync(backupDir, { recursive: true });
  config = makeConfig();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function dir(name: string): void {
  mkdirSync(join(backupDir, name), { recursive: true });
  writeFileSync(join(backupDir, name, 'data.sqlite.gz'), 'ciphertext-and-metadata');
}

function file(name: string, body = 'x'): void {
  writeFileSync(join(backupDir, name), body);
}

/** Lists the direct entries of the backup folder. */
function entries(): string[] {
  return readdirSync(backupDir).sort();
}

describe('rotateBackups', () => {
  it('deletes our backups older than the retention, and keeps the ones inside it', async () => {
    dir('verification-20260101T000000Z'); // 284 days old
    dir('verification-20260712T120000Z'); // 92 days old
    dir('verification-20260915T120000Z'); // 27 days old
    dir('verification-20261012T120000Z'); // now

    const removed = await rotateBackups(config, T0);

    expect(removed.sort()).toEqual([
      'verification-20260101T000000Z',
      'verification-20260712T120000Z',
    ]);
    expect(entries()).toEqual(['verification-20260915T120000Z', 'verification-20261012T120000Z']);
  });

  it('keeps a backup of exactly the retention age, and deletes one second older', async () => {
    // T0 minus 90 days is 2026-07-14T12:00:00Z: the boundary is inclusive.
    dir('verification-20260714T120000Z');
    dir('verification-20260714T115959Z');

    await rotateBackups(config, T0);

    expect(entries()).toEqual(['verification-20260714T120000Z']);
  });

  it('leaves every entry that is not one of our backups, and deletes only our old temporary folders', async () => {
    dir('verification-20260102T000000Z'); // ours, old: removed
    dir('.tmp-verification-20260101T000000Z-abcdef12'); // a run cut short, old: removed
    dir('.tmp-verification-20261009T120000Z-1a2b3c4d'); // three days old, inside the retention: removed (a day is the limit)
    dir('.tmp-verification-20261012T100000Z-2b3c4d5e'); // two hours old: kept
    dir('.tmp-verification-20261012T115900Z-00ff00ff'); // a run in progress: kept
    file('keres-20260101T000000Z.dump', 'a Postgres dump, not ours');
    file('verification-notes.txt', 'written by a person');
    file('verification-20260101T000000Z', 'a file with our name, not a folder');
    dir('verification-20260101T000000Z.bak'); // a near miss
    dir('verification-20261332T000000Z'); // not a date
    dir('verification-2026-01-01'); // another shape
    dir('notes'); // a person's folder

    const removed = await rotateBackups(config, T0);

    expect(removed.sort()).toEqual([
      '.tmp-verification-20260101T000000Z-abcdef12',
      '.tmp-verification-20261009T120000Z-1a2b3c4d',
      'verification-20260102T000000Z',
    ]);
    expect(entries()).toEqual(
      [
        '.tmp-verification-20261012T100000Z-2b3c4d5e',
        '.tmp-verification-20261012T115900Z-00ff00ff',
        'keres-20260101T000000Z.dump',
        'notes',
        'verification-20260101T000000Z',
        'verification-20260101T000000Z.bak',
        'verification-20261332T000000Z',
        'verification-2026-01-01',
        'verification-notes.txt',
      ].sort(),
    );
  });

  it('does not reach outside BACKUP_DIR, even for a folder named like ours next to it', async () => {
    const outside = join(root, 'verification-20200101T000000Z');
    mkdirSync(outside);

    await rotateBackups(config, T0);

    expect(existsSync(outside)).toBe(true);
  });

  it('follows the retention of the configuration: 30 days removes a 32-day-old backup', async () => {
    const thirty = makeConfig({ BACKUP_RETENTION_DAYS: '30' });
    dir('verification-20260910T120000Z'); // 32 days old
    dir('verification-20260915T120000Z'); // 27 days old

    await rotateBackups(thirty, T0);

    expect(entries()).toEqual(['verification-20260915T120000Z']);
  });

  it('does nothing when BACKUP_DIR is unset or does not exist yet', async () => {
    await expect(rotateBackups({ ...config, backupDir: undefined }, T0)).resolves.toEqual([]);
    await expect(
      rotateBackups({ ...config, backupDir: join(root, 'never-made') }, T0),
    ).resolves.toEqual([]);
  });
});
