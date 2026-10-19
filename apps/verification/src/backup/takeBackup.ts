import { Database } from 'bun:sqlite';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { VerificationConfig } from '../config';
import {
  backupNameFor,
  BackupError,
  BLOBS_DIR,
  SNAPSHOT_FILE,
  stampOf,
  TEMP_PREFIX,
} from './layout';

/**
 * One backup of the data store: `BACKUP_DIR/verification-<stamp>/`, holding
 *   - `data.sqlite.gz`: a consistent copy of `data.sqlite`, made with `VACUUM INTO` while the service keeps writing;
 *   - `blobs/`: a byte-for-byte copy of the encrypted image files that copy names. Nothing is decrypted.
 *
 * The key store (`keys.sqlite`) is never opened, read or copied, and no secret of the service is written: a backup is
 * ciphertext plus the metadata that names it, and it is unreadable once the key of a sending is destroyed (see
 * `docs/age_verification.md`). The folder is written under a temporary name and renamed when complete, so a run that
 * stops halfway leaves no `verification-*` folder behind.
 */

/** How long a backup waits for a writer that holds the database for a moment, before it gives up. */
const BUSY_TIMEOUT_MS = 10_000;
const gzipAsync = promisify(gzip);
/** The file names the service gives its blobs: 16 random bytes in hex, then `.bin`. Anything else is refused. */
const BLOB_NAME_PATTERN = /^[0-9a-f]{32}\.bin$/;

export interface BackupResult {
  /** The finished folder. */
  folder: string;
  /** Its name, `verification-<UTC stamp>`. */
  name: string;
  /** Image files copied into the backup. */
  blobsCopied: number;
  /**
   * Images the snapshot names that were gone when the copy reached them: they were decided or expired meanwhile, and
   * their keys were destroyed first. They are not in the backup, which is what the decision asked for.
   */
  blobsGone: number;
}

export interface TakeBackupHooks {
  /** Test seam: runs once the temporary folder is complete, just before it is renamed into place. */
  beforeCommit?: (temporaryFolder: string) => Promise<void> | void;
}

/**
 * Takes one backup at `now`. Throws `BackupError` when backups are off or the data store does not exist yet; any other
 * failure is the file system's or SQLite's, and leaves no temporary folder behind.
 */
export async function takeBackup(
  config: VerificationConfig,
  now: number,
  hooks: TakeBackupHooks = {},
): Promise<BackupResult> {
  if (config.backupDir === undefined) {
    throw new BackupError('BACKUP_DIR is not set: backups are off.');
  }
  const backupDir = config.backupDir;
  const liveFile = join(config.dataDir, 'data.sqlite');
  if (!existsSync(liveFile)) throw new BackupError('The data store does not exist yet.');

  const name = backupNameFor(now);
  const folder = join(backupDir, name);
  if (existsSync(folder)) throw new BackupError(`The backup ${name} already exists.`);

  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const temporary = join(
    backupDir,
    `${TEMP_PREFIX}${stampOf(now)}-${randomBytes(4).toString('hex')}`,
  );
  await mkdir(temporary, { mode: 0o700 });
  try {
    const blobNames = await snapshotDataStore(liveFile, temporary);
    const copied = await copyBlobs(
      join(config.dataDir, BLOBS_DIR),
      join(temporary, BLOBS_DIR),
      blobNames,
    );
    await hooks.beforeCommit?.(temporary);
    await rename(temporary, folder);
    return { folder, name, ...copied };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Writes the gzipped snapshot of the data store into `temporary` and returns the blob names it refers to. The plain copy
 * is removed once compressed: it holds the same personal metadata, and nothing needs it uncompressed.
 */
async function snapshotDataStore(liveFile: string, temporary: string): Promise<string[]> {
  const plain = join(temporary, 'data.sqlite');
  const live = new Database(liveFile);
  try {
    live.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    // The live database is in WAL mode, so this reads the last committed state and does not stop the service writing.
    live.prepare('VACUUM INTO ?').run(plain);
  } finally {
    live.close();
  }
  const blobNames = blobNamesOf(plain);
  // Read and compressed in memory, not streamed: the snapshot holds metadata only, and on Windows under Bun a stream
  // left the plain file open, so its removal failed with EBUSY.
  const compressed = await gzipAsync(await readFile(plain));
  await writeFile(join(temporary, SNAPSHOT_FILE), compressed, { mode: 0o600 });
  await rm(plain, { force: true });
  return blobNames;
}

/** The blob files the snapshot names. The names come from the database, so they are checked before any path is built. */
function blobNamesOf(snapshot: string): string[] {
  const db = new Database(snapshot);
  try {
    // A rollback journal, so no `-wal` or `-shm` side file is left beside the snapshot once it is closed.
    db.exec('PRAGMA journal_mode = DELETE');
    const statement = db.prepare('SELECT blobs_json FROM submissions WHERE blobs_json IS NOT NULL');
    let rows: { blobs_json: string }[];
    try {
      rows = statement.all() as { blobs_json: string }[];
    } finally {
      // Bun keeps the file open until the statement is finalized, and Windows then refuses to delete the snapshot (EBUSY).
      // Node's statements have no finalize and do not hold the file, so the call is made only where it exists.
      (statement as { finalize?: () => void }).finalize?.();
    }
    const names = new Set<string>();
    for (const row of rows) {
      for (const blob of JSON.parse(row.blobs_json) as { fileName?: unknown }[]) {
        if (typeof blob.fileName !== 'string' || !BLOB_NAME_PATTERN.test(blob.fileName)) {
          throw new BackupError('The data store names an image file the service would not write.');
        }
        names.add(blob.fileName);
      }
    }
    return [...names];
  } finally {
    db.close();
  }
}

async function copyBlobs(
  fromDir: string,
  toDir: string,
  names: readonly string[],
): Promise<{ blobsCopied: number; blobsGone: number }> {
  await mkdir(toDir, { mode: 0o700 });
  let blobsCopied = 0;
  let blobsGone = 0;
  for (const name of names) {
    try {
      await copyFile(join(fromDir, name), join(toDir, name));
      blobsCopied += 1;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        blobsGone += 1;
        continue;
      }
      throw error;
    }
  }
  return { blobsCopied, blobsGone };
}
