import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  backupFolderName,
  createDataBackup,
  defaultBackupParent,
  describeBackupResult,
} from '../../src/launcher/backup';
import type { LauncherPublicConfig } from '../../src/launcher/config';
import { createTranslator } from '../../src/launcher/i18n';

function sampleConfig(dataDir: string): LauncherPublicConfig {
  return {
    language: 'en',
    databaseDriver: 'sqlite',
    databaseUrl: `file:${dataDir.replace(/\\/g, '/')}/keres.db`,
    mediaStorageDriver: 'local',
    mediaStoragePath: path.join(dataDir, 'media-storage'),
    host: '127.0.0.1',
    port: '3000',
    dataDir,
    rootAdminUsername: 'root',
  };
}

describe('backup', () => {
  it('names the folder with local date and time', () => {
    expect(backupFolderName(new Date(2026, 7, 20, 15, 4, 9))).toBe('2026-08-20_15-04-09');
  });

  it('keeps backups beside the live data folder, not inside it', () => {
    expect(defaultBackupParent('/home/sam/.local/share/keres-server').replace(/\\/g, '/')).toBe(
      '/home/sam/.local/share/keres-server-backups',
    );
  });

  it('copies sqlite, sidecars, config, secrets and local media into the dated folder', () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'keres-live-'));
    mkdirSync(path.join(dataDir, 'media-storage'), { recursive: true });
    writeFileSync(path.join(dataDir, 'keres.db'), 'db');
    writeFileSync(path.join(dataDir, 'keres.db-wal'), 'wal');
    writeFileSync(path.join(dataDir, 'config.json'), '{}');
    writeFileSync(path.join(dataDir, 'secrets.json'), '{}');
    writeFileSync(path.join(dataDir, 'media-storage', 'photo.bin'), 'img');

    const parent = mkdtempSync(path.join(os.tmpdir(), 'keres-bak-'));
    const result = createDataBackup({
      config: sampleConfig(dataDir),
      destinationParent: parent,
      now: new Date(2026, 7, 20, 9, 0, 0),
    });

    expect(result.destination).toBe(path.join(parent, '2026-08-20_09-00-00'));
    expect(result.copied.sort()).toEqual(
      ['config.json', 'keres.db', 'keres.db-wal', 'media-storage', 'secrets.json'].sort(),
    );
    expect(readFileSync(path.join(result.destination, 'keres.db'), 'utf8')).toBe('db');
    expect(readFileSync(path.join(result.destination, 'media-storage', 'photo.bin'), 'utf8')).toBe(
      'img',
    );
  });

  it('refuses to write a backup inside the live data folder', () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'keres-live-'));
    expect(() =>
      createDataBackup({
        config: sampleConfig(dataDir),
        destinationParent: path.join(dataDir, 'inside'),
      }),
    ).toThrow(/inside the live data folder/);
  });

  it('notes postgres and s3 instead of pretending they were copied', () => {
    const t = createTranslator('en');
    const lines = describeBackupResult(
      t,
      { destination: '/tmp/b', copied: ['config.json'] },
      {
        ...sampleConfig('/tmp/data'),
        databaseDriver: 'postgres',
        mediaStorageDriver: 's3',
      },
    );
    expect(lines.join('\n')).toMatch(/PostgreSQL was not dumped/);
    expect(lines.join('\n')).toMatch(/S3 were not copied/);
  });
});
