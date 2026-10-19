import {
  claimSubmission,
  decideApprove,
  decideReject,
  DecisionError,
  REVIEWER_REJECTION_REASONS,
  type ReviewedIdentity,
} from '../../decisions';
import type { ServiceState } from '../../routes';
import type { SubmissionRow } from '../../store/submissions';
import { htmlResponse, type Lang, newNonce, seeOther } from '../http';
import { pageLanguage } from '../language';
import type { ReviewFlash } from '../reviewMessages';
import { textField } from './form';
import { attemptOf } from './queries';
import type { ReviewSession } from './session';
import { REVIEW_PATH } from './session';
import { itemHtml } from './reviewView';

/**
 * What a reviewer does with one sending: claim it, look at it (the claimer only), approve it, refuse it. The rules are
 * the decisions module's; this file only turns its answers into pages. A typed approval is read from the form, handed
 * to the decision, and dropped: on any failure the form comes back empty.
 */

const KINDS: readonly string[] = ['rg', 'cnh', 'passport', 'other-id'];
const MAX_NAME_LENGTH = 200;
const MAX_NUMBER_LENGTH = 64;

/** The sending, if this reviewer holds it and it is still open for a decision. */
export function claimedItem(
  state: ServiceState,
  submissionId: string,
  reviewerId: string,
  now: number,
): SubmissionRow | undefined {
  const row = state.stores.submissions.byId(submissionId);
  if (!row || row.status !== 'claimed' || row.reviewerId !== reviewerId) return undefined;
  return row.expiresAt > now ? row : undefined;
}

const flashTo = (flash: ReviewFlash): Response => seeOther(`${REVIEW_PATH}?flash=${flash}`);

/** The flash for a decision the rules refused, as the reviewer should read it on the queue. */
function flashOfDecision(code: DecisionError['code']): ReviewFlash {
  switch (code) {
    case 'same_reviewer':
      return 'retry-refused';
    case 'claimed_by_other':
      return 'held-by-other';
    default:
      return 'not-open';
  }
}

/** Why a sending cannot be opened by this reviewer, as a flash for the queue. */
function flashWhenNotHeld(
  state: ServiceState,
  submissionId: string,
  reviewerId: string,
  now: number,
): ReviewFlash {
  const row = state.stores.submissions.byId(submissionId);
  if (row && row.status === 'uploaded' && row.expiresAt > now) return 'not-claimed';
  if (row && row.status === 'claimed' && row.reviewerId !== reviewerId && row.expiresAt > now) {
    return 'held-by-other';
  }
  return 'not-open';
}

function langOf(request: Request): Lang {
  return pageLanguage(undefined, request.headers.get('accept-language'));
}

/** The item screen again, blank form, with the reason it was refused. */
function itemAgain(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  row: SubmissionRow,
  error: 'underage' | 'invalidIdentity' | 'reasonNotSelectable',
): Response {
  const nonce = newNonce();
  const html = itemHtml({
    lang: langOf(request),
    nonce,
    csrf: session.csrf,
    row,
    attempt: attemptOf(state, row.retryOf),
    error,
  });
  return htmlResponse(200, html, nonce);
}

export function itemPage(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  submissionId: string,
): Response {
  const now = state.clock();
  const row = claimedItem(state, submissionId, session.reviewer.id, now);
  if (!row) return flashTo(flashWhenNotHeld(state, submissionId, session.reviewer.id, now));
  const nonce = newNonce();
  const html = itemHtml({
    lang: langOf(request),
    nonce,
    csrf: session.csrf,
    row,
    attempt: attemptOf(state, row.retryOf),
  });
  return htmlResponse(200, html, nonce);
}

export function claimAction(
  state: ServiceState,
  session: ReviewSession,
  submissionId: string,
): Response {
  // The rules answer a sending held by someone else as "not open"; the reviewer should be told whose it is.
  const held = state.stores.submissions.byId(submissionId);
  if (
    held?.status === 'claimed' &&
    held.reviewerId !== session.reviewer.id &&
    held.expiresAt > state.clock()
  ) {
    return flashTo('held-by-other');
  }
  try {
    claimSubmission(state, submissionId, session.reviewer.id);
  } catch (error) {
    if (!(error instanceof DecisionError)) throw error;
    return flashTo(flashOfDecision(error.code));
  }
  return seeOther(`${REVIEW_PATH}/items/${encodeURIComponent(submissionId)}`);
}

/** Maps the rules' refusal of a decision to what the screen shows: a message on the item, or a flash on the queue. */
function refusedDecision(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  submissionId: string,
  error: DecisionError,
): Response {
  if (
    error.code === 'underage' ||
    error.code === 'invalid_identity' ||
    error.code === 'reason_not_selectable'
  ) {
    const row = claimedItem(state, submissionId, session.reviewer.id, state.clock());
    if (row) {
      const code =
        error.code === 'underage'
          ? 'underage'
          : error.code === 'invalid_identity'
            ? 'invalidIdentity'
            : 'reasonNotSelectable';
      return itemAgain(request, state, session, row, code);
    }
  }
  return flashTo(flashOfDecision(error.code));
}

export function approveAction(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  submissionId: string,
  form: FormData,
): Response {
  const now = state.clock();
  if (!claimedItem(state, submissionId, session.reviewer.id, now)) {
    return flashTo(flashWhenNotHeld(state, submissionId, session.reviewer.id, now));
  }
  const identity: ReviewedIdentity = {
    name: textField(form, 'name', true),
    kind: textField(form, 'kind', true),
    number: textField(form, 'number', true),
    dateOfBirth: textField(form, 'dateOfBirth', true),
  };
  const row = claimedItem(state, submissionId, session.reviewer.id, now);
  if (
    !KINDS.includes(identity.kind) ||
    identity.name.length > MAX_NAME_LENGTH ||
    identity.number.length > MAX_NUMBER_LENGTH
  ) {
    return row ? itemAgain(request, state, session, row, 'invalidIdentity') : flashTo('not-open');
  }
  try {
    decideApprove(state, submissionId, session.reviewer.id, identity);
  } catch (error) {
    if (!(error instanceof DecisionError)) throw error;
    return row
      ? refusedDecision(request, state, session, submissionId, error)
      : flashTo(flashOfDecision(error.code));
  }
  return flashTo('approved');
}

export function rejectAction(
  request: Request,
  state: ServiceState,
  session: ReviewSession,
  submissionId: string,
  form: FormData,
): Response {
  const now = state.clock();
  const row = claimedItem(state, submissionId, session.reviewer.id, now);
  if (!row) return flashTo(flashWhenNotHeld(state, submissionId, session.reviewer.id, now));
  const chosen = textField(form, 'reason');
  const reason = REVIEWER_REJECTION_REASONS.find((candidate) => candidate === chosen);
  if (!reason) return itemAgain(request, state, session, row, 'reasonNotSelectable');
  try {
    decideReject(state, submissionId, session.reviewer.id, reason);
  } catch (error) {
    if (!(error instanceof DecisionError)) throw error;
    return refusedDecision(request, state, session, submissionId, error);
  }
  return flashTo('rejected');
}
