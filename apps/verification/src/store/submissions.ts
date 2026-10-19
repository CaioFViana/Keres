import type { Database } from './sql';
import { all, one, run } from './sql';

/**
 * One verification sending, as the service keeps it. The row holds no personal data: the ids and the subject the
 * server named (a user id and a username, enough for a reviewer to see whose account it is), the status, the dates,
 * and the metadata of the encrypted files (names, sizes, content types). The images themselves are files in the
 * blob directory, encrypted with the key that the key store holds and this row never does.
 */

export const SUBMISSION_STATUSES = [
  'pending',
  'uploaded',
  'claimed',
  'approved',
  'rejected',
  'expired',
  'canceled',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Still waiting for a decision: the only states the service may destroy on expiry or cancellation. */
export const OPEN_SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  'pending',
  'uploaded',
  'claimed',
];

/** The reviewer's decisions. `expired` and `canceled` are endings, not decisions. */
export const DECIDED_SUBMISSION_STATUSES: readonly SubmissionStatus[] = ['approved', 'rejected'];

export const BLOB_ROLES = ['document-front', 'document-back', 'photo'] as const;
export type BlobRole = (typeof BLOB_ROLES)[number];

/** What the row says about one encrypted file. The file name is random; nothing in it names the person. */
export interface BlobMeta {
  role: BlobRole;
  fileName: string;
  size: number;
  contentType: string;
}

export interface SubmissionRow {
  id: string;
  verificationId: string;
  providerReference: string;
  subjectUserId: string;
  subjectUsername: string;
  language: string;
  /** The `providerReference` of the refused sending this one retries, if any. */
  retryOf: string | null;
  /** SHA-256 of the one-time upload token. The token itself is never stored. */
  uploadTokenHash: string;
  status: SubmissionStatus;
  createdAt: number;
  uploadedAt: number | null;
  expiresAt: number;
  decidedAt: number | null;
  /** The reviewer who holds the claim (set by `claim`, kept after the decision). */
  reviewerId: string | null;
  /** The reviewer who made the decision. The retry rule reads it. */
  decidedByReviewer: string | null;
  /** The encrypted files' metadata as JSON, or null once they were destroyed. */
  blobsJson: string | null;
}

export interface NewSubmission {
  id: string;
  verificationId: string;
  providerReference: string;
  subjectUserId: string;
  subjectUsername: string;
  language: string;
  retryOf: string | null;
  uploadTokenHash: string;
  createdAt: number;
  expiresAt: number;
}

interface RawRow {
  id: string;
  verification_id: string;
  provider_reference: string;
  subject_user_id: string;
  subject_username: string;
  language: string;
  retry_of: string | null;
  upload_token_hash: string;
  status: SubmissionStatus;
  created_at: number;
  uploaded_at: number | null;
  expires_at: number;
  decided_at: number | null;
  reviewer_id: string | null;
  decided_by_reviewer: string | null;
  blobs_json: string | null;
}

const COLUMNS = `id, verification_id, provider_reference, subject_user_id, subject_username, language, retry_of,
  upload_token_hash, status, created_at, uploaded_at, expires_at, decided_at, reviewer_id, decided_by_reviewer,
  blobs_json`;

function toRow(raw: RawRow): SubmissionRow {
  return {
    id: raw.id,
    verificationId: raw.verification_id,
    providerReference: raw.provider_reference,
    subjectUserId: raw.subject_user_id,
    subjectUsername: raw.subject_username,
    language: raw.language,
    retryOf: raw.retry_of,
    uploadTokenHash: raw.upload_token_hash,
    status: raw.status,
    createdAt: raw.created_at,
    uploadedAt: raw.uploaded_at,
    expiresAt: raw.expires_at,
    decidedAt: raw.decided_at,
    reviewerId: raw.reviewer_id,
    decidedByReviewer: raw.decided_by_reviewer,
    blobsJson: raw.blobs_json,
  };
}

export class SubmissionStore {
  constructor(private readonly db: Database) {}

  insert(row: NewSubmission): void {
    run(
      this.db,
      `INSERT INTO submissions (id, verification_id, provider_reference, subject_user_id, subject_username, language,
         retry_of, upload_token_hash, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      row.id,
      row.verificationId,
      row.providerReference,
      row.subjectUserId,
      row.subjectUsername,
      row.language,
      row.retryOf,
      row.uploadTokenHash,
      row.createdAt,
      row.expiresAt,
    );
  }

  byId(id: string): SubmissionRow | undefined {
    const raw = one<RawRow>(this.db, `SELECT ${COLUMNS} FROM submissions WHERE id = ?`, id);
    return raw && toRow(raw);
  }

  byVerificationId(verificationId: string): SubmissionRow | undefined {
    const raw = one<RawRow>(
      this.db,
      `SELECT ${COLUMNS} FROM submissions WHERE verification_id = ?`,
      verificationId,
    );
    return raw && toRow(raw);
  }

  byProviderReference(providerReference: string): SubmissionRow | undefined {
    const raw = one<RawRow>(
      this.db,
      `SELECT ${COLUMNS} FROM submissions WHERE provider_reference = ?`,
      providerReference,
    );
    return raw && toRow(raw);
  }

  /** The submission an upload token opens. The page (a later task) calls this with the hash of what it was given. */
  byUploadTokenHash(uploadTokenHash: string): SubmissionRow | undefined {
    const raw = one<RawRow>(
      this.db,
      `SELECT ${COLUMNS} FROM submissions WHERE upload_token_hash = ?`,
      uploadTokenHash,
    );
    return raw && toRow(raw);
  }

  /** Open submissions whose offer has run out, oldest first. */
  expiredOpen(now: number): SubmissionRow[] {
    return all<RawRow>(
      this.db,
      `SELECT ${COLUMNS} FROM submissions
       WHERE status IN ('pending', 'uploaded', 'claimed') AND expires_at <= ?
       ORDER BY expires_at, id`,
      now,
    ).map(toRow);
  }

  setUploadTokenHash(id: string, uploadTokenHash: string): void {
    run(this.db, 'UPDATE submissions SET upload_token_hash = ? WHERE id = ?', uploadTokenHash, id);
  }

  markUploaded(id: string, now: number): void {
    run(
      this.db,
      `UPDATE submissions SET status = 'uploaded', uploaded_at = ? WHERE id = ? AND status = 'pending'`,
      now,
      id,
    );
  }

  markClaimed(id: string, reviewerId: string): void {
    run(
      this.db,
      `UPDATE submissions SET status = 'claimed', reviewer_id = ? WHERE id = ? AND status IN ('uploaded', 'claimed')`,
      reviewerId,
      id,
    );
  }

  markDecided(
    id: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    decidedAt: number,
  ): void {
    run(
      this.db,
      `UPDATE submissions SET status = ?, reviewer_id = ?, decided_by_reviewer = ?, decided_at = ? WHERE id = ?`,
      status,
      reviewerId,
      reviewerId,
      decidedAt,
      id,
    );
  }

  /** Ends an open submission without a reviewer's decision (expiry, cancellation). */
  markEnded(id: string, status: 'expired' | 'canceled', at: number): void {
    run(this.db, `UPDATE submissions SET status = ?, decided_at = ? WHERE id = ?`, status, at, id);
  }

  setBlobs(id: string, blobs: BlobMeta[] | null): void {
    run(
      this.db,
      'UPDATE submissions SET blobs_json = ? WHERE id = ?',
      blobs === null ? null : JSON.stringify(blobs),
      id,
    );
  }
}
