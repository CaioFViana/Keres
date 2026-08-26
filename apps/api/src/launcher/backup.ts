import { cpSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import type { LauncherPublicConfig } from './config';
import type { Translate } from './i18n';
import {
  CONFIG_FILE_NAME,
  DEFAULT_MEDIA_DIR_NAME,
  SECRETS_FILE_NAME,
  SQLITE_FILE_NAME,
} from './paths';

const SQLITE_SIDECARS = [`${SQLITE_FILE_NAME}-wal`, `${SQLITE_FILE_NAME}-shm`];

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

export function createDataBackup(options: {
  config: LauncherPublicConfig;
  destinationParent?: string;
  now?: Date;
}): { destination: string; copied: string[] } {
  const dataDir = options.config.dataDir;
  const parent = path.resolve(options.destinationParent ?? defaultBackupParent(dataDir));
  const destination = path.join(parent, backupFolderName(options.now));
  const relative = path.relative(dataDir, destination);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('Backup folder cannot be inside the live data folder.');
  }

  mkdirSync(destination, { recursive: true });
  const copied: string[] = [];

  for (const name of [SQLITE_FILE_NAME, ...SQLITE_SIDECARS, CONFIG_FILE_NAME, SECRETS_FILE_NAME]) {
    if (copyIfExists(path.join(dataDir, name), path.join(destination, name))) {
      copied.push(name);
    }
  }

  if (options.config.mediaStorageDriver === 'local') {
    const mediaFrom = options.config.mediaStoragePath ?? path.join(dataDir, DEFAULT_MEDIA_DIR_NAME);
    if (copyIfExists(mediaFrom, path.join(destination, DEFAULT_MEDIA_DIR_NAME))) {
      copied.push(DEFAULT_MEDIA_DIR_NAME);
    }
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
