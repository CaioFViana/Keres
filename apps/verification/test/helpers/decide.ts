import type { VerificationRejectionReason } from '@keres/shared';
import {
  claimSubmission,
  decideApprove,
  decideReject,
  type ReviewedIdentity,
} from '../../src/decisions';
import type { Harness } from './harness';

/**
 * A reviewer decides a sending only after claiming it, which is how the service puts the reviewer's name on every
 * image they look at. These wrappers take that claim for an uploaded sending, then call the real decision.
 *
 * A claim the rules refuse (another reviewer's, a retry the reviewer may not take, an expired offer) throws its
 * DecisionError unchanged, so the tests about those codes keep their meaning. A sending in any other state is not
 * claimed here: the real decision refuses it by itself.
 */
function claimIfUploaded(h: Harness, submissionId: string, reviewerId: string): void {
  const row = h.state.stores.submissions.byId(submissionId);
  if (row?.status === 'uploaded') claimSubmission(h.state, submissionId, reviewerId);
}

/** Claims the sending for the reviewer when needed, then approves it with the real rules. */
export function approve(
  h: Harness,
  submissionId: string,
  reviewerId: string,
  identity: ReviewedIdentity,
): void {
  claimIfUploaded(h, submissionId, reviewerId);
  decideApprove(h.state, submissionId, reviewerId, identity);
}

/** Claims the sending for the reviewer when needed, then rejects it with the real rules. */
export function reject(
  h: Harness,
  submissionId: string,
  reviewerId: string,
  reason: VerificationRejectionReason,
): void {
  claimIfUploaded(h, submissionId, reviewerId);
  decideReject(h.state, submissionId, reviewerId, reason);
}
