import { join } from 'node:path';
import { overwriteAndDelete, parseBlobs } from '../store/blobs';
import type { Stores } from '../store/stores';

/**
 * Destroys everything a submission holds that is worth something: the data key, then the encrypted files, then the
 * metadata that names them. The key goes first (crypto-shredding): from that moment any copy of a ciphertext - a
 * backup, a file left behind by an interrupted run - is unreadable, so the files can be removed at leisure, and an
 * interruption after this line loses nothing but the tidying up.
 *
 * Idempotent: a second call finds no key, no files and no metadata, and does nothing. Used by a decision, by expiry,
 * by a cancellation from Keres, and by the retry of any of them.
 */
export function destroySubmission(stores: Stores, submissionId: string): void {
  stores.keys.delete(submissionId);

  const row = stores.submissions.byId(submissionId);
  if (!row || row.blobsJson === null) return;
  for (const blob of parseBlobs(row.blobsJson)) {
    overwriteAndDelete(join(stores.blobDir, blob.fileName));
  }
  stores.submissions.setBlobs(submissionId, null);
}
