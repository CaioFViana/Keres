import {
  VERIFICATION_REJECTION_REASONS,
  type VerificationEventWire,
  type VerificationRejectionReason,
} from '@keres/shared';
import { isAdultOn, parseCalendarDate } from './age';
import { commitment, normalizeIdentity } from './crypto/commitment';
import type { Services } from './services';
import { destroySubmission } from './crypto/destroy';
import type { SubmissionRow } from './store/submissions';
import { transaction } from './store/sql';

/**
 * What a reviewer does with a sending: claim it, approve it (after reading the document and the photo and typing the
 * identity), or reject it with a reason. Each decision destroys the images and the key, writes its audit line and
 * queues the signed event for Keres - in one place, so the rules cannot be bypassed by a route.
 *
 * What the reviewer types for an approval (name, document kind and number, date of birth) is used to compute the
 * commitment and then dropped: it is not stored, not logged, not put in the audit line, not in the event.
 */

export const VERIFICATION_METHOD = 'manual-document-live-photo';

/** The reasons a reviewer may choose. `document_reused` is the service's own finding (a commitment seen before), never a reviewer's. */
export const REVIEWER_REJECTION_REASONS: readonly VerificationRejectionReason[] =
  VERIFICATION_REJECTION_REASONS.filter((reason) => reason !== 'document_reused');

export const DECISION_ERROR_CODES = [
  'not_found',
  'not_open',
  'claimed_by_other',
  'not_claimed',
  'same_reviewer',
  'underage',
  'invalid_identity',
  'reason_not_selectable',
] as const;
export type DecisionErrorCode = (typeof DECISION_ERROR_CODES)[number];

/** A decision the rules refuse. The code is for the caller; the message is for the log and the reviewer. */
export class DecisionError extends Error {
  constructor(
    readonly code: DecisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DecisionError';
  }
}

/** The identity as the reviewer typed it. Used once, to compute the commitment and the age, then discarded. */
export interface ReviewedIdentity {
  name: string;
  kind: string;
  number: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
}

/** The id of the event for one outcome of one submission: the same every time, so a re-queue never doubles it. */
export const eventIdFor = (
  submissionId: string,
  outcome: 'approved' | 'rejected' | 'expired',
): string => `verification-${outcome}-${submissionId}`;

const iso = (ms: number): string => new Date(ms).toISOString();

/** Statuses a reviewer may still claim or decide. */
const DECIDABLE_STATUSES: readonly SubmissionRow['status'][] = ['uploaded', 'claimed'];

/** Retry chains are short (the account limit is a handful); the bound guards against a corrupt loop. */
const MAX_RETRY_CHAIN = 100;

/**
 * A sending is decided only while its offer runs: past `expiresAt` it is over even before the expiry sweep has run,
 * so no decision can land in the gap between the offer ending and the sweep.
 */
function loadOpen(services: Services, submissionId: string, reviewerId: string): SubmissionRow {
  const row = services.stores.submissions.byId(submissionId);
  if (!row) throw new DecisionError('not_found', 'No such submission.');
  if (!DECIDABLE_STATUSES.includes(row.status)) {
    throw new DecisionError(
      'not_open',
      `The submission is ${row.status}, not open for a decision.`,
    );
  }
  if (row.expiresAt <= services.clock()) {
    throw new DecisionError('not_open', 'The offer has run out: the submission is expired.');
  }
  if (row.status === 'claimed' && row.reviewerId !== reviewerId) {
    throw new DecisionError('claimed_by_other', 'Another reviewer holds this submission.');
  }
  // A decision is made on what the reviewer holds: the claim is what puts the reviewer's name on the audit trail of
  // every image they looked at, so a sending nobody claimed cannot be decided.
  if (row.status !== 'claimed') {
    throw new DecisionError('not_claimed', 'Claim the submission before deciding it.');
  }
  if (reviewerDecidedEarlierSending(services, row, reviewerId)) {
    throw new DecisionError(
      'same_reviewer',
      'A reviewer who refused an earlier sending of this person does not take the retry.',
    );
  }
  return row;
}

/**
 * Walks the `retryOf` chain: true when this reviewer decided any earlier sending. A refusal is never a dead end, but
 * it is looked at by someone else.
 */
function reviewerDecidedEarlierSending(
  services: Services,
  row: SubmissionRow,
  reviewerId: string,
): boolean {
  let reference = row.retryOf;
  for (let depth = 0; reference !== null && depth < MAX_RETRY_CHAIN; depth += 1) {
    const previous = services.stores.submissions.byProviderReference(reference);
    if (!previous) return false;
    if (previous.decidedByReviewer === reviewerId) return true;
    reference = previous.retryOf;
  }
  return false;
}

/** Takes the claim on an uploaded sending. Claiming again by the holder is a no-op. */
export function claimSubmission(
  services: Services,
  submissionId: string,
  reviewerId: string,
): void {
  const row = services.stores.submissions.byId(submissionId);
  if (!row) throw new DecisionError('not_found', 'No such submission.');
  if (row.status === 'claimed' && row.reviewerId === reviewerId) return;
  if (row.status !== 'uploaded') {
    throw new DecisionError('not_open', `The submission is ${row.status}, it cannot be claimed.`);
  }
  if (row.expiresAt <= services.clock()) {
    throw new DecisionError('not_open', 'The offer has run out: the submission is expired.');
  }
  if (reviewerDecidedEarlierSending(services, row, reviewerId)) {
    throw new DecisionError(
      'same_reviewer',
      'A reviewer who refused an earlier sending does not take the retry.',
    );
  }
  const now = services.clock();
  transaction(services.stores.data, () => {
    services.stores.submissions.markClaimed(submissionId, reviewerId);
    services.stores.audit.record({ at: now, reviewerId, submissionId, action: 'claim' });
  });
}

/**
 * Approves a sending. Refuses when the holder is under 18 on the day of the decision, which the reviewer must then
 * refuse as `underage` instead. Returns nothing: the outcome goes to Keres through the outbox.
 */
export function decideApprove(
  services: Services,
  submissionId: string,
  reviewerId: string,
  identity: ReviewedIdentity,
): void {
  const row = loadOpen(services, submissionId, reviewerId);
  const now = services.clock();

  const dateOfBirth = parseCalendarDate(identity.dateOfBirth);
  if (!dateOfBirth)
    throw new DecisionError('invalid_identity', 'The date of birth is not a calendar date.');
  if (!isAdultOn(dateOfBirth, new Date(now))) {
    throw new DecisionError('underage', 'The holder is under 18 on the day of the decision.');
  }
  const normalized = normalizeIdentity(identity);
  if (normalized.name === '' || normalized.kind === '' || normalized.number === '') {
    throw new DecisionError(
      'invalid_identity',
      'The name, the document kind and the number are required.',
    );
  }
  const identityCommitment = commitment(services.config.commitmentKey, identity);

  // The images and the key go first; the record of the decision and its event follow in one transaction.
  destroySubmission(services.stores, row.id);
  transaction(services.stores.data, () => {
    services.stores.submissions.markDecided(row.id, 'approved', reviewerId, now);
    services.stores.audit.record({ at: now, reviewerId, submissionId: row.id, action: 'approve' });
    const event: VerificationEventWire = {
      type: 'verification.approved',
      eventId: eventIdFor(row.id, 'approved'),
      verificationId: row.verificationId,
      providerReference: row.providerReference,
      decidedAt: iso(now),
      method: VERIFICATION_METHOD,
      identityCommitment,
      discardedAt: iso(now),
    };
    services.stores.outbox.enqueue(event, now);
  });
}

/** Refuses a sending with a reason a reviewer may choose. */
export function decideReject(
  services: Services,
  submissionId: string,
  reviewerId: string,
  reason: VerificationRejectionReason,
): void {
  if (!REVIEWER_REJECTION_REASONS.includes(reason)) {
    throw new DecisionError(
      'reason_not_selectable',
      `A reviewer cannot refuse with reason ${reason}.`,
    );
  }
  const row = loadOpen(services, submissionId, reviewerId);
  const now = services.clock();

  destroySubmission(services.stores, row.id);
  transaction(services.stores.data, () => {
    services.stores.submissions.markDecided(row.id, 'rejected', reviewerId, now);
    services.stores.audit.record({ at: now, reviewerId, submissionId: row.id, action: 'reject' });
    const event: VerificationEventWire = {
      type: 'verification.rejected',
      eventId: eventIdFor(row.id, 'rejected'),
      verificationId: row.verificationId,
      providerReference: row.providerReference,
      decidedAt: iso(now),
      reason,
      discardedAt: iso(now),
    };
    services.stores.outbox.enqueue(event, now);
  });
}

/**
 * Ends every open sending past its offer: destroys it and queues `verification.expired`. Returns how many ended. Safe to
 * run again at any time: an ended sending is no longer open, so it is not ended twice.
 */
export function expireOverdue(services: Services): number {
  const now = services.clock();
  let ended = 0;
  for (const row of services.stores.submissions.expiredOpen(now)) {
    destroySubmission(services.stores, row.id);
    transaction(services.stores.data, () => {
      services.stores.submissions.markEnded(row.id, 'expired', now);
      services.stores.audit.record({
        at: now,
        reviewerId: null,
        submissionId: row.id,
        action: 'expire',
      });
      const event: VerificationEventWire = {
        type: 'verification.expired',
        eventId: eventIdFor(row.id, 'expired'),
        verificationId: row.verificationId,
        providerReference: row.providerReference,
        discardedAt: iso(now),
      };
      services.stores.outbox.enqueue(event, now);
    });
    ended += 1;
  }
  return ended;
}
