import type { Database } from './sql';
import { one, run } from './sql';

/**
 * The data keys, one per submission, in `keys.sqlite` (its own directory, never backed up). Nothing else is in this
 * database. Deleting a row is the act that makes the submission's encrypted files unreadable everywhere they were
 * copied: `destroySubmission` deletes the key before it touches a single file.
 */
export class KeyStore {
  constructor(private readonly db: Database) {}

  put(submissionId: string, dataKey: Uint8Array): void {
    run(
      this.db,
      'INSERT INTO data_keys (submission_id, data_key) VALUES (?, ?)',
      submissionId,
      dataKey,
    );
  }

  get(submissionId: string): Uint8Array | undefined {
    const raw = one<{ data_key: Uint8Array }>(
      this.db,
      'SELECT data_key FROM data_keys WHERE submission_id = ?',
      submissionId,
    );
    return raw && new Uint8Array(raw.data_key);
  }

  /** Idempotent: deleting an absent key does nothing. */
  delete(submissionId: string): void {
    run(this.db, 'DELETE FROM data_keys WHERE submission_id = ?', submissionId);
  }
}
