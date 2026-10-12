import { AUDIT_ACTIONS } from './audit';
import { SUBMISSION_STATUSES } from './submissions';

/**
 * The two databases of the service. `data.sqlite` holds everything except the data keys: submissions (metadata
 * only), the audit log, reviewers, their sessions and the event outbox. `keys.sqlite` holds only
 * `(submissionId, dataKey)` rows and lives in its own directory, which is never backed up.
 */

const quoted = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

export const DATA_SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL UNIQUE,
  provider_reference TEXT NOT NULL UNIQUE,
  subject_user_id TEXT NOT NULL,
  subject_username TEXT NOT NULL,
  language TEXT NOT NULL,
  retry_of TEXT,
  upload_token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (${quoted(SUBMISSION_STATUSES)})),
  created_at INTEGER NOT NULL,
  uploaded_at INTEGER,
  expires_at INTEGER NOT NULL,
  decided_at INTEGER,
  reviewer_id TEXT,
  decided_by_reviewer TEXT,
  blobs_json TEXT
);
CREATE INDEX IF NOT EXISTS submissions_open_expiry ON submissions (status, expires_at);
CREATE INDEX IF NOT EXISTS submissions_upload_token ON submissions (upload_token_hash);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  reviewer_id TEXT,
  submission_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (${quoted(AUDIT_ACTIONS)}))
);
CREATE INDEX IF NOT EXISTS audit_log_submission ON audit_log (submission_id);

CREATE TABLE IF NOT EXISTS reviewers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  reviewer_id TEXT NOT NULL REFERENCES reviewers (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS event_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS event_outbox_due ON event_outbox (delivered_at, next_attempt_at);
`;

export const KEY_SCHEMA = `
CREATE TABLE IF NOT EXISTS data_keys (
  submission_id TEXT PRIMARY KEY,
  data_key BLOB NOT NULL
);
`;

/**
 * Pragmas of the key database. A rollback journal (not WAL) and `secure_delete` make a deleted key leave no copy in
 * the file or a side file: crypto-shredding is only as good as the key's disappearance from the bytes on disk.
 */
export const KEY_PRAGMAS = [
  'PRAGMA journal_mode = DELETE',
  'PRAGMA secure_delete = ON',
  'PRAGMA synchronous = FULL',
] as const;

/** The data database may be WAL: it holds no key. */
export const DATA_PRAGMAS = ['PRAGMA journal_mode = WAL', 'PRAGMA foreign_keys = ON'] as const;
