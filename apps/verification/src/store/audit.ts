import type { Database } from './sql';
import { all, run } from './sql';

/**
 * The audit log: who did what to which submission, and when. It never holds content - not the document, not the
 * photo, not a name or number typed by a reviewer. Viewing an image is recorded here, so the administrators can see
 * how often and by whom an image was looked at.
 */

export const AUDIT_ACTIONS = [
  'view-document',
  'view-photo',
  'claim',
  'approve',
  'reject',
  'expire',
  'cancel',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  id: number;
  at: number;
  reviewerId: string | null;
  submissionId: string;
  action: AuditAction;
}

interface RawEntry {
  id: number;
  at: number;
  reviewer_id: string | null;
  submission_id: string;
  action: AuditAction;
}

export class AuditLog {
  constructor(private readonly db: Database) {}

  /** `reviewerId` is null for what the service does on its own (expiry, a cancellation from Keres). */
  record(entry: {
    at: number;
    reviewerId: string | null;
    submissionId: string;
    action: AuditAction;
  }): void {
    run(
      this.db,
      'INSERT INTO audit_log (at, reviewer_id, submission_id, action) VALUES (?, ?, ?, ?)',
      entry.at,
      entry.reviewerId,
      entry.submissionId,
      entry.action,
    );
  }

  forSubmission(submissionId: string): AuditEntry[] {
    return all<RawEntry>(
      this.db,
      'SELECT id, at, reviewer_id, submission_id, action FROM audit_log WHERE submission_id = ? ORDER BY id',
      submissionId,
    ).map((raw) => ({
      id: raw.id,
      at: raw.at,
      reviewerId: raw.reviewer_id,
      submissionId: raw.submission_id,
      action: raw.action,
    }));
  }
}
