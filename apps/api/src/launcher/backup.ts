import {
  chmodSync,
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import * as path from 'node:path';
import type { LauncherPublicConfig } from './config';
import type { Translate } from './i18n';
import {
  CONFIG_FILE_NAME,
  DEFAULT_MEDIA_DIR_NAME,
  SECRETS_FILE_NAME,
  SQLITE_FILE_NAME,
} from './paths';

export function backupFolderName(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/** The backups' parent folder, next to the data folder - never inside it. */
export function defaultBackupParent(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, '')}-backups`;
}

function copyIfExists(from: string, to: string): boolean {
  if (!existsSync(from)) {
    return false;
  }
  mkdirSync(path.dirname(to), { recursive: true });
  const stats = statSync(from);
  if (stats.isDirectory()) {
    cpSync(from, to, { recursive: true });
  } else {
    copyFileSync(from, to);
  }
  return true;
}

/** A folder name that is free under `parent`: two backups in the same second must not end up merged into one. */
function freeDestination(parent: string, name: string): string {
  let candidate = path.join(parent, name);
  for (let attempt = 2; existsSync(candidate); attempt += 1) {
    candidate = path.join(parent, `${name}-${attempt}`);
  }
  return candidate;
}

/**
 * Renames a folder that files were just closed in. Windows may still count a database file as open for a
 * moment after it was closed (an antivirus scan, the driver letting go), and refuses the rename meanwhile.
 */
async function renameWhenReleased(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== 'EPERM' && code !== 'EBUSY') || attempt >= 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

function restrictToOwner(filePath: string): void {
  if (process.platform === 'win32') return;
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Better a copy with the permissions it got than no copy on an odd filesystem.
  }
}

/**
 * A consistent copy of the SQLite database, made by SQLite itself (`VACUUM INTO`).
 *
 * Copying the file and its `-wal`/`-shm` sidecars by hand is only right when nothing has written between
 * the one copy and the next - and a server that was killed rather than stopped leaves a log that only
 * SQLite knows how to replay. This reads through SQLite, so it holds whether the server is stopped,
 * was killed or is still running.
 */
async function snapshotSqlite(source: string, destination: string): Promise<void> {
  const { createClient } = await import('@libsql/client');
  const urlFor = (file: string) => `file:${file.replace(/\\/g, '/')}`;
  const live = createClient({ url: urlFor(source) });
  try {
    await live.execute({ sql: 'VACUUM INTO ?', args: [destination] });
  } finally {
    live.close();
  }
}

/**
 * Opens the finished copy and has SQLite check it. Done once the folder has its final name: on Windows a
 * database that was opened keeps its folder from being renamed for the rest of the process.
 */
async function verifySqliteCopy(file: string): Promise<void> {
  const { createClient } = await import('@libsql/client');
  const copy = createClient({ url: `file:${file.replace(/\\/g, '/')}` });
  try {
    const result = await copy.execute('PRAGMA integrity_check');
    const verdict = String(result.rows[0]?.[0] ?? '');
    if (verdict !== 'ok') {
      throw new Error(
        `The database copy in ${file} did not pass the integrity check (${verdict}); do not rely on this backup.`,
      );
    }
  } finally {
    copy.close();
  }
}

/**
 * Copies the data into a dated folder under the backup parent.
 *
 * It is built in a `.partial` folder and only given its real name when everything is in it: a backup that
 * stopped halfway (disk full, a file locked) must not sit there looking like a complete one.
 */
export async function createDataBackup(options: {
  config: LauncherPublicConfig;
  destinationParent?: string;
  now?: Date;
}): Promise<{ destination: string; copied: string[] }> {
  const dataDir = options.config.dataDir;
  const parent = path.resolve(options.destinationParent ?? defaultBackupParent(dataDir));
  const relative = path.relative(dataDir, path.join(parent, backupFolderName(options.now)));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('Backup folder cannot be inside the live data folder.');
  }

  mkdirSync(parent, { recursive: true });
  const destination = freeDestination(parent, backupFolderName(options.now));
  const staging = `${destination}.partial`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const copied: string[] = [];

  try {
    const databaseFile = path.join(dataDir, SQLITE_FILE_NAME);
    if (options.config.databaseDriver === 'sqlite' && existsSync(databaseFile)) {
      await snapshotSqlite(databaseFile, path.join(staging, SQLITE_FILE_NAME));
      copied.push(SQLITE_FILE_NAME);
    }

    for (const name of [CONFIG_FILE_NAME, SECRETS_FILE_NAME]) {
      if (copyIfExists(path.join(dataDir, name), path.join(staging, name))) {
        restrictToOwner(path.join(staging, name));
        copied.push(name);
      }
    }

    if (options.config.mediaStorageDriver === 'local') {
      const mediaFrom =
        options.config.mediaStoragePath ?? path.join(dataDir, DEFAULT_MEDIA_DIR_NAME);
      if (copyIfExists(mediaFrom, path.join(staging, DEFAULT_MEDIA_DIR_NAME))) {
        copied.push(DEFAULT_MEDIA_DIR_NAME);
      }
    }

    await renameWhenReleased(staging, destination);
    if (copied.includes(SQLITE_FILE_NAME)) {
      await verifySqliteCopy(path.join(destination, SQLITE_FILE_NAME));
    }
  } catch (error) {
    try {
      rmSync(staging, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // The error that matters is the one that stopped the backup, not this cleanup.
    }
    throw error;
  }

  return { destination, copied };
}

export function describeBackupResult(
  t: Translate,
  result: { destination: string; copied: string[] },
  config: LauncherPublicConfig,
): string[] {
  const lines = [t('backup_done', { path: result.destination })];
  if (result.copied.length === 0) {
    lines.push(t('backup_empty'));
  }
  if (config.databaseDriver === 'postgres') {
    lines.push(t('backup_postgres_note'));
  }
  if (config.mediaStorageDriver === 's3') {
    lines.push(t('backup_s3_note'));
  }
  lines.push(t('backup_restart'));
  return lines;
}
