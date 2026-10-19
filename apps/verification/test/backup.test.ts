import { Database } from 'bun:sqlite';
import { gunzipSync } from 'node:zlib';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { takeBackup } from '../src/backup/takeBackup';
import { BackupError, BLOBS_DIR, SNAPSHOT_FILE } from '../src/backup/layout';
import { readBlob, storeBlob, BlobUnreadable } from '../src/store/blobs';
import { openStores } from '../src/store/stores';
import { startVerification } from '../src/verifications';
import { reject } from './helpers/decide';
import {
  bytesContain,
  COMMITMENT_KEY,
  EVENTS_SECRET,
  filesUnder,
  harness,
  type Harness,
  KERES_SECRET,
  T0,
} from './helpers/harness';
import type { VerificationConfig } from '../src/config';

/**
 * The backup of the data store. The tests exercise the real snapshot (`VACUUM INTO`), the real blob copy and the real
 * restore path (gunzip the snapshot, copy the blobs back, open the stores): what a backup is worth is what comes out
 * of it, not what the code says it writes.
 */

const PLAIN = Buffer.from('FRONT OF THE DOCUMENT - a distinctive pretend image body 0123456789');
const ROWS_SQL =
  'SELECT id, verification_id, status, subject_username, blobs_json FROM submissions ORDER BY id';

let h: Harness;
let config: VerificationConfig;
let backupDir: string;

beforeEach(() => {
  h = harness();
  backupDir = join(h.root, 'backups');
  config = { ...h.config, backupDir };
});
afterEach(() => {
  h.close();
});

function pendingSubmission(verificationId: string, username = 'ana'): string {
  return startVerification(h.state, {
    verificationId,
    subject: { userId: `user-${verificationId}`, username },
    language: 'pt-BR',
  }).row.id;
}

/** The snapshot of a backup, uncompressed. */
function snapshotBytes(folder: string): Buffer {
  return gunzipSync(readFileSync(join(folder, SNAPSHOT_FILE)));
}

/** Restores a backup the way the README says to: the snapshot as `data.sqlite`, the blobs back into `blobs/`. */
function restoreInto(folder: string, root: string): string {
  const dataDir = join(root, 'data');
  mkdirSync(join(dataDir, BLOBS_DIR), { recursive: true });
  writeFileSync(join(dataDir, 'data.sqlite'), snapshotBytes(folder));
  for (const name of readdirSync(join(folder, BLOBS_DIR))) {
    copyFileSync(join(folder, BLOBS_DIR, name), join(dataDir, BLOBS_DIR, name));
  }
  return dataDir;
}

describe('takeBackup: the data snapshot', () => {
  it('writes a gzipped snapshot that is a valid SQLite database with the rows of the live one', async () => {
    pendingSubmission('v-one', 'ana');
    pendingSubmission('v-two', 'bea');
    const live = JSON.stringify(h.state.stores.data.prepare(ROWS_SQL).all());

    const result = await takeBackup(config, T0);

    expect(result.name).toBe('verification-20261012T120000Z');
    expect(result.folder).toBe(join(backupDir, 'verification-20261012T120000Z'));
    const restored = join(h.root, 'restored-check');
    mkdirSync(restored);
    writeFileSync(join(restored, 'snapshot.sqlite'), snapshotBytes(result.folder));
    const copy = new Database(join(restored, 'snapshot.sqlite'));
    try {
      expect(copy.prepare('PRAGMA integrity_check').get()).toEqual(
        expect.objectContaining({ integrity_check: 'ok' }),
      );
      expect(JSON.stringify(copy.prepare(ROWS_SQL).all())).toBe(live);
    } finally {
      copy.close();
    }
    // Only the snapshot and the blobs folder: no plain copy, no side file, no key store.
    expect(readdirSync(result.folder).sort()).toEqual([BLOBS_DIR, SNAPSHOT_FILE].sort());
  });

  it('reads the live database while it is being written: the snapshot holds what was committed, and the writer goes on', async () => {
    pendingSubmission('v-committed-a');
    pendingSubmission('v-committed-b');
    const data = h.state.stores.data;
    const committedOutbox = JSON.stringify(
      data.prepare('SELECT event_id FROM event_outbox ORDER BY id').all(),
    );
    const committedRows = JSON.stringify(data.prepare(ROWS_SQL).all());

    // A write is in flight on the live database when the backup runs: it is not committed yet.
    data.exec('BEGIN IMMEDIATE');
    data.exec(
      "INSERT INTO event_outbox (event_id, payload_json, created_at, next_attempt_at) VALUES ('in-flight', '{}', 1, 1)",
    );
    let result;
    try {
      result = await takeBackup(config, T0);
    } finally {
      data.exec('COMMIT');
    }

    const restored = restoreInto(result.folder, join(h.root, 'restore-during-write'));
    const copy = new Database(join(restored, 'data.sqlite'));
    try {
      expect(
        JSON.stringify(copy.prepare('SELECT event_id FROM event_outbox ORDER BY id').all()),
      ).toBe(committedOutbox);
      expect(JSON.stringify(copy.prepare(ROWS_SQL).all())).toBe(committedRows);
    } finally {
      copy.close();
    }
    // The write committed after the backup, so the live database has it and the backup does not.
    expect(
      data.prepare("SELECT COUNT(*) AS n FROM event_outbox WHERE event_id = 'in-flight'").get(),
    ).toEqual(expect.objectContaining({ n: 1 }));
  });

  it('refuses a blob name the service would not write, and leaves no folder behind', async () => {
    const id = pendingSubmission('v-bad-name');
    h.state.stores.data
      .prepare('UPDATE submissions SET blobs_json = ? WHERE id = ?')
      .run(
        JSON.stringify([
          { role: 'photo', fileName: '../keys/keys.sqlite', size: 1, contentType: 'image/png' },
        ]),
        id,
      );

    await expect(takeBackup(config, T0)).rejects.toThrow(BackupError);
    expect(existsSync(backupDir) ? readdirSync(backupDir) : []).toEqual([]);
  });
});

describe('takeBackup: the blobs and the keys', () => {
  it('copies every image it names byte for byte, and each copy is still ciphertext', async () => {
    const id = pendingSubmission('v-blobs');
    const front = storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    const photo = storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: Buffer.from('a live photo, pretend, different bytes'),
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });

    const result = await takeBackup(config, T0);

    expect(result.blobsCopied).toBe(2);
    expect(result.blobsGone).toBe(0);
    for (const meta of [front, photo]) {
      const original = readFileSync(join(h.state.stores.blobDir, meta.fileName));
      const copy = readFileSync(join(result.folder, BLOBS_DIR, meta.fileName));
      expect(copy.equals(original)).toBe(true);
      expect(copy.includes(PLAIN)).toBe(false);
    }
  });

  it('never copies the key store, and no byte of the backup holds a data key or a service secret', async () => {
    const id = pendingSubmission('v-keys');
    storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    const key = h.state.stores.keys.get(id) as Uint8Array;
    // Positive control: the scan can find this key where it lives, so a miss in the backup means something.
    expect(bytesContain(h.state.config.keyDir, key)).toBe(true);

    const result = await takeBackup(config, T0);

    const names = filesUnder(result.folder).map((file) => file.slice(result.folder.length));
    expect(names.some((name) => name.includes('keys'))).toBe(false);
    expect(bytesContain(result.folder, key)).toBe(false);
    expect(snapshotBytes(result.folder).includes(Buffer.from(key))).toBe(false);
    for (const secret of [COMMITMENT_KEY, KERES_SECRET, EVENTS_SECRET]) {
      expect(bytesContain(result.folder, secret)).toBe(false);
    }
  });

  it('a backup taken before a decision cannot be opened once the decision destroys the key', async () => {
    const id = pendingSubmission('v-decided');
    storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    h.state.stores.submissions.markUploaded(id, h.now());
    const result = await takeBackup(config, T0);

    // Before the decision the copy opens with the key the service holds: the positive control.
    const beforeDir = restoreInto(result.folder, join(h.root, 'restore-before'));
    const before = openStores({ dataDir: beforeDir, keyDir: h.config.keyDir });
    try {
      expect(Buffer.from(readBlob(before, id, 'document-front') as Uint8Array).equals(PLAIN)).toBe(
        true,
      );
    } finally {
      before.close();
    }

    reject(h, id, 'reviewer-1', 'face_mismatch');
    expect(h.state.stores.keys.get(id)).toBeUndefined();

    // After the decision: the same backup, restored, still names the file, and nothing opens it.
    const afterDir = restoreInto(result.folder, join(h.root, 'restore-after'));
    const after = openStores({ dataDir: afterDir, keyDir: h.config.keyDir });
    try {
      expect(after.submissions.byId(id)?.blobsJson).not.toBeNull();
      expect(() => readBlob(after, id, 'document-front')).toThrow(BlobUnreadable);
    } finally {
      after.close();
    }
  });
});

describe('takeBackup: refusals and interruption', () => {
  it('refuses when BACKUP_DIR is unset, and when the data store does not exist yet', async () => {
    await expect(takeBackup({ ...config, backupDir: undefined }, T0)).rejects.toThrow(
      /BACKUP_DIR is not set/,
    );
    const empty = { ...config, dataDir: join(h.root, 'nowhere') };
    await expect(takeBackup(empty, T0)).rejects.toThrow(/does not exist yet/);
    expect(existsSync(backupDir)).toBe(false);
  });

  it('refuses to overwrite the backup of the same second', async () => {
    await takeBackup(config, T0);
    await expect(takeBackup(config, T0)).rejects.toThrow(/already exists/);
  });

  it('an interrupted run leaves no verification-* folder: the temporary folder is removed', async () => {
    pendingSubmission('v-interrupted');
    await expect(
      takeBackup(config, T0, {
        beforeCommit: () => {
          throw new Error('simulated power cut');
        },
      }),
    ).rejects.toThrow('simulated power cut');

    const entries = existsSync(backupDir) ? readdirSync(backupDir) : [];
    expect(entries.filter((name) => name.startsWith('verification-'))).toEqual([]);
    expect(entries).toEqual([]);

    // The next run succeeds under the same name, as if the failed one had never started.
    const result = await takeBackup(config, T0);
    expect(readdirSync(backupDir)).toEqual([result.name]);
  });
});
