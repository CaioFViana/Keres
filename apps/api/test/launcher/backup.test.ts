import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createClient } from '@libsql/client';
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

const urlFor = (file: string) => `file:${file.replace(/\\/g, '/')}`;

/** A real SQLite database in WAL mode, like the server's, left open: the server is "running". */
async function liveDatabase(file: string, rows: string[]) {
  const client = createClient({ url: urlFor(file) });
  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('CREATE TABLE notes (body TEXT NOT NULL)');
  for (const body of rows) {
    await client.execute({ sql: 'INSERT INTO notes (body) VALUES (?)', args: [body] });
  }
  return client;
}

async function readNotes(file: string): Promise<string[]> {
  const client = createClient({ url: urlFor(file) });
  try {
    const result = await client.execute('SELECT body FROM notes ORDER BY rowid');
    return result.rows.map((row) => String(row[0]));
  } finally {
    client.close();
  }
}

const tempDir = (prefix: string) => mkdtempSync(path.join(os.tmpdir(), prefix));

describe('backup', () => {
  it('names the folder with local date and time', () => {
    expect(backupFolderName(new Date(2026, 7, 20, 15, 4, 9))).toBe('2026-08-20_15-04-09');
  });

  it('keeps backups beside the live data folder, not inside it', () => {
    expect(defaultBackupParent('/home/sam/.local/share/keres-server').replace(/\\/g, '/')).toBe(
      '/home/sam/.local/share/keres-server-backups',
    );
  });

  it('copies the database, config, secrets and local media into the dated folder', async () => {
    const dataDir = tempDir('keres-live-');
    mkdirSync(path.join(dataDir, 'media-storage'), { recursive: true });
    const live = await liveDatabase(path.join(dataDir, 'keres.db'), ['first']);
    writeFileSync(path.join(dataDir, 'config.json'), '{}');
    writeFileSync(path.join(dataDir, 'secrets.json'), '{}');
    writeFileSync(path.join(dataDir, 'media-storage', 'photo.bin'), 'img');

    const parent = tempDir('keres-bak-');
    try {
      const result = await createDataBackup({
        config: sampleConfig(dataDir),
        destinationParent: parent,
        now: new Date(2026, 7, 20, 9, 0, 0),
      });

      expect(result.destination).toBe(path.join(parent, '2026-08-20_09-00-00'));
      expect(result.copied.sort()).toEqual(
        ['config.json', 'keres.db', 'media-storage', 'secrets.json'].sort(),
      );
      expect(
        readFileSync(path.join(result.destination, 'media-storage', 'photo.bin'), 'utf8'),
      ).toBe('img');
      // Nothing is left half-built beside it.
      expect(readdirSync(parent)).toEqual(['2026-08-20_09-00-00']);
    } finally {
      live.close();
    }
  });

  it('takes a consistent copy of a database that is being written to, WAL included', async () => {
    const dataDir = tempDir('keres-live-');
    const live = await liveDatabase(path.join(dataDir, 'keres.db'), ['one', 'two']);
    // Rows that exist only in the write-ahead log while the server runs: a copy of the main file
    // alone would not have them.
    await live.execute({ sql: 'INSERT INTO notes (body) VALUES (?)', args: ['three'] });
    expect(existsSync(path.join(dataDir, 'keres.db-wal'))).toBe(true);
    const parent = tempDir('keres-bak-');
    try {
      const result = await createDataBackup({
        config: sampleConfig(dataDir),
        destinationParent: parent,
      });

      expect(await readNotes(path.join(result.destination, 'keres.db'))).toEqual([
        'one',
        'two',
        'three',
      ]);
      // The copy stands alone: no sidecar files to lose track of.
      expect(readdirSync(result.destination).filter((name) => name.startsWith('keres.db'))).toEqual(
        ['keres.db'],
      );
    } finally {
      live.close();
    }
  });

  it('leaves no backup behind, and says why, when the database cannot be copied', async () => {
    const dataDir = tempDir('keres-live-');
    writeFileSync(path.join(dataDir, 'keres.db'), 'this is not a database, just bytes'.repeat(40));
    writeFileSync(path.join(dataDir, 'config.json'), '{}');
    const parent = tempDir('keres-bak-');

    await expect(
      createDataBackup({ config: sampleConfig(dataDir), destinationParent: parent }),
    ).rejects.toThrow();

    // Neither a finished-looking folder nor a half-built one.
    expect(readdirSync(parent)).toEqual([]);
  });

  it('does not create an empty database when there is none to copy', async () => {
    const dataDir = tempDir('keres-live-');
    writeFileSync(path.join(dataDir, 'config.json'), '{}');
    const parent = tempDir('keres-bak-');

    const result = await createDataBackup({
      config: sampleConfig(dataDir),
      destinationParent: parent,
    });

    expect(result.copied).toEqual(['config.json']);
    expect(existsSync(path.join(dataDir, 'keres.db'))).toBe(false);
  });

  it('gives a second backup in the same second a folder of its own', async () => {
    const dataDir = tempDir('keres-live-');
    writeFileSync(path.join(dataDir, 'config.json'), '{}');
    const parent = tempDir('keres-bak-');
    const now = new Date(2026, 7, 20, 9, 0, 0);

    const first = await createDataBackup({
      config: sampleConfig(dataDir),
      destinationParent: parent,
      now,
    });
    const second = await createDataBackup({
      config: sampleConfig(dataDir),
      destinationParent: parent,
      now,
    });

    expect(first.destination).not.toBe(second.destination);
    expect(readdirSync(parent).sort()).toEqual(['2026-08-20_09-00-00', '2026-08-20_09-00-00-2']);
  });

  it.skipIf(process.platform === 'win32')(
    'keeps the secrets readable only by their owner',
    async () => {
      const dataDir = tempDir('keres-live-');
      writeFileSync(path.join(dataDir, 'secrets.json'), '{"jwtSecret":"x"}', { mode: 0o644 });
      const parent = tempDir('keres-bak-');

      const result = await createDataBackup({
        config: sampleConfig(dataDir),
        destinationParent: parent,
      });

      expect(statSync(path.join(result.destination, 'secrets.json')).mode & 0o777).toBe(0o600);
    },
  );

  it('refuses to write a backup inside the live data folder', async () => {
    const dataDir = tempDir('keres-live-');
    await expect(
      createDataBackup({
        config: sampleConfig(dataDir),
        destinationParent: path.join(dataDir, 'inside'),
      }),
    ).rejects.toThrow(/inside the live data folder/);
    expect(existsSync(path.join(dataDir, 'inside'))).toBe(false);
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
