import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { openBlob, sealBlob } from '../crypto/seal';
import type { Stores } from './stores';
import type { BlobMeta, BlobRole, SubmissionRow } from './submissions';

/**
 * The encrypted files of a submission. The bytes are sealed with the submission's data key and written to the blob
 * directory under a random name; the row keeps only the name, size and content type. The order is deliberate:
 * the metadata names a file before the file exists, so a crash never leaves a ciphertext the row does not know of
 * (destruction walks the row).
 */

export class BlobRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlobRefused';
  }
}

/** The key is gone (the submission was decided, expired or cancelled): the files can no longer be read. */
export class BlobUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlobUnreadable';
  }
}

/** A blob may be stored only while the person can still send, or a reviewer is still looking. */
const STORABLE_STATUSES: readonly SubmissionRow['status'][] = ['pending', 'uploaded'];

export function parseBlobs(json: string | null): BlobMeta[] {
  return json === null ? [] : (JSON.parse(json) as BlobMeta[]);
}

/**
 * Seals `plain` with the submission's key and stores it. A second blob with the same role replaces the first, and the
 * first file is overwritten and removed.
 */
export function storeBlob(
  stores: Stores,
  submissionId: string,
  input: { role: BlobRole; plain: Uint8Array; contentType: string; maxBytes: number },
): BlobMeta {
  const row = stores.submissions.byId(submissionId);
  if (!row || !STORABLE_STATUSES.includes(row.status)) {
    throw new BlobRefused('The submission does not accept files.');
  }
  if (input.plain.length === 0 || input.plain.length > input.maxBytes) {
    throw new BlobRefused('The file is empty or larger than the limit.');
  }
  const key = stores.keys.get(submissionId);
  if (!key) throw new BlobRefused('The submission has no data key.');

  const sealed = sealBlob(input.plain, key);
  const fileName = `${randomBytes(16).toString('hex')}.bin`;
  const meta: BlobMeta = {
    role: input.role,
    fileName,
    size: sealed.ciphertext.length,
    contentType: input.contentType,
  };
  const replaced = parseBlobs(row.blobsJson).filter((blob) => blob.role === input.role);
  const kept = parseBlobs(row.blobsJson).filter((blob) => blob.role !== input.role);
  stores.submissions.setBlobs(submissionId, [...kept, meta]);
  for (const old of replaced) overwriteAndDelete(join(stores.blobDir, old.fileName));
  writeNewFile(join(stores.blobDir, fileName), sealed.ciphertext);
  return meta;
}

/**
 * Decrypts the file of `role`. Once the key row is gone this throws `BlobUnreadable` whatever copy of the ciphertext
 * is at hand: the key is the only way in, and it is destroyed first.
 */
export function readBlob(
  stores: Stores,
  submissionId: string,
  role: BlobRole,
): Uint8Array | undefined {
  const row = stores.submissions.byId(submissionId);
  const meta = parseBlobs(row?.blobsJson ?? null).find((blob) => blob.role === role);
  if (!meta) return undefined;
  const key = stores.keys.get(submissionId);
  if (!key) throw new BlobUnreadable('The data key of this submission was destroyed.');
  return openBlob(readFileSync(join(stores.blobDir, meta.fileName)), key);
}

/** Creates the file, refusing to overwrite one that is already there (names are random, so that is a bug). */
function writeNewFile(path: string, bytes: Uint8Array): void {
  const fd = openSync(path, 'wx', 0o600);
  try {
    writeSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * Overwrites the file with random bytes of its own length, flushes it, and removes it. A missing file is already
 * destroyed: that is what makes destruction repeatable. On copy-on-write or flash storage an overwrite is not a
 * guarantee - which is why the key is destroyed first, and why the ciphertext is worthless without it.
 */
export function overwriteAndDelete(path: string): void {
  if (!existsSync(path)) return;
  const size = statSync(path).size;
  const fd = openSync(path, 'r+');
  try {
    writeSync(fd, randomBytes(size), 0, size, 0);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  unlinkSync(path);
}
