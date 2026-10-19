import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commitment } from '../src/crypto/commitment';
import {
  claimSubmission,
  decideApprove,
  decideReject,
  DecisionError,
  eventIdFor,
  expireOverdue,
  type ReviewedIdentity,
  VERIFICATION_METHOD,
} from '../src/decisions';
import { all } from '../src/store/sql';
import { storeBlob } from '../src/store/blobs';
import { startVerification } from '../src/verifications';
import { approve, reject } from './helpers/decide';
import { bytesContain, COMMITMENT_KEY, harness, type Harness, T0 } from './helpers/harness';

const IMAGE = Buffer.from('pretend JPEG bytes of a document, distinctive 4242');
const ADULT: ReviewedIdentity = {
  name: 'Maria da Silva',
  kind: 'CPF',
  number: '123.456.789-09',
  dateOfBirth: '1990-07-23',
};
const DAY = 24 * 60 * 60 * 1000;

/** The error code a decision raised, or 'none' when it did not raise. */
function codeOf(work: () => void): string {
  try {
    work();
  } catch (error) {
    if (error instanceof DecisionError) return error.code;
    throw error;
  }
  return 'none';
}

let h: Harness;
let counter = 0;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  h.close();
});

/** A sending started, its image stored and the upload marked done, as the upload page will leave it. */
function uploaded(options: { userId?: string; retryOf?: string } = {}): {
  id: string;
  providerReference: string;
} {
  counter += 1;
  const started = startVerification(h.state, {
    verificationId: `v-${counter}`,
    subject: { userId: options.userId ?? 'user-1', username: 'ana' },
    language: 'pt-BR',
    ...(options.retryOf ? { retryOf: options.retryOf } : {}),
  });
  const id = started.row.id;
  storeBlob(h.state.stores, id, {
    role: 'document-front',
    plain: IMAGE,
    contentType: 'image/jpeg',
    maxBytes: 1 << 20,
  });
  storeBlob(h.state.stores, id, {
    role: 'photo',
    plain: IMAGE,
    contentType: 'image/jpeg',
    maxBytes: 1 << 20,
  });
  h.state.stores.submissions.markUploaded(id, h.now());
  return { id, providerReference: started.row.providerReference };
}

const outboxFor = (eventId: string): number =>
  all<{ n: number }>(
    h.state.stores.data,
    'SELECT COUNT(*) AS n FROM event_outbox WHERE event_id = ?',
    eventId,
  )[0]?.n ?? 0;

describe('approval', () => {
  it('approves an adult: the submission ends, its files and key are destroyed, the event is queued with the commitment', () => {
    const { id } = uploaded();
    approve(h, id, 'reviewer-1', ADULT);

    const row = h.state.stores.submissions.byId(id);
    expect(row?.status).toBe('approved');
    expect(row?.decidedByReviewer).toBe('reviewer-1');
    expect(row?.decidedAt).toBe(T0);
    expect(row?.blobsJson).toBeNull();
    expect(h.state.stores.keys.get(id)).toBeUndefined();

    const payload = h.state.stores.outbox.payloadOf(eventIdFor(id, 'approved'));
    expect(payload).toEqual({
      type: 'verification.approved',
      eventId: eventIdFor(id, 'approved'),
      verificationId: row?.verificationId,
      providerReference: row?.providerReference,
      decidedAt: new Date(T0).toISOString(),
      method: VERIFICATION_METHOD,
      identityCommitment: commitment(COMMITMENT_KEY, ADULT),
      discardedAt: new Date(T0).toISOString(),
    });
    expect(h.state.stores.audit.forSubmission(id).map((entry) => entry.action)).toEqual([
      'claim',
      'approve',
    ]);
  });

  it('refuses a holder under 18 on the day of the decision, and leaves the sending as it was', () => {
    const { id } = uploaded();
    const underage = { ...ADULT, dateOfBirth: '2008-10-13' };
    expect(codeOf(() => approve(h, id, 'reviewer-1', underage))).toBe('underage');

    // The refusal changes nothing but the claim the reviewer took to look at the sending.
    expect(h.state.stores.submissions.byId(id)?.status).toBe('claimed');
    expect(h.state.stores.keys.get(id)).toBeDefined();
    expect(h.state.stores.outbox.payloadOf(eventIdFor(id, 'approved'))).toBeUndefined();
  });

  it('applies the birthday rule with the fixed clock: 17 the day before the 18th birthday, 18 on it', () => {
    const { id } = uploaded();
    const birthday = { ...ADULT, dateOfBirth: '2008-10-12' };
    h.setNow(Date.UTC(2026, 9, 11, 23, 59, 0));
    expect(codeOf(() => approve(h, id, 'reviewer-1', birthday))).toBe('underage');
    h.setNow(Date.UTC(2026, 9, 12, 0, 0, 0));
    expect(codeOf(() => approve(h, id, 'reviewer-1', birthday))).toBe('none');
    expect(h.state.stores.submissions.byId(id)?.status).toBe('approved');
  });

  it('handles 29 February: a holder born on it is adult on 1 March of a year without one, not on 28 February', () => {
    const leap = { ...ADULT, dateOfBirth: '2000-02-29' };
    h.setNow(Date.UTC(2018, 1, 1, 12));
    const first = uploaded();
    h.setNow(Date.UTC(2018, 1, 28, 12));
    expect(codeOf(() => approve(h, first.id, 'reviewer-1', leap))).toBe('underage');
    h.setNow(Date.UTC(2018, 2, 1, 12));
    expect(codeOf(() => approve(h, first.id, 'reviewer-1', leap))).toBe('none');
  });

  it('refuses a decision once the offer has run out, even before the expiry sweep has run', () => {
    const { id } = uploaded();
    h.setNow(T0 + 30 * DAY);
    expect(codeOf(() => decideApprove(h.state, id, 'reviewer-1', ADULT))).toBe('not_open');
    expect(codeOf(() => claimSubmission(h.state, id, 'reviewer-1'))).toBe('not_open');
    expect(h.state.stores.submissions.byId(id)?.status).toBe('uploaded');
  });

  it('refuses a date of birth that is not a calendar date, and an identity without its name or number', () => {
    const { id } = uploaded();
    expect(
      codeOf(() => approve(h, id, 'reviewer-1', { ...ADULT, dateOfBirth: '2008-02-30' })),
    ).toBe('invalid_identity');
    expect(codeOf(() => approve(h, id, 'reviewer-1', { ...ADULT, name: '   ' }))).toBe(
      'invalid_identity',
    );
    expect(codeOf(() => approve(h, id, 'reviewer-1', { ...ADULT, number: '.-' }))).toBe(
      'invalid_identity',
    );
    expect(h.state.stores.submissions.byId(id)?.status).toBe('claimed');
  });

  it('refuses a sending that is not open: pending (no upload yet), already decided, or expired', () => {
    const started = startVerification(h.state, {
      verificationId: 'v-pending',
      subject: { userId: 'user-9', username: 'bea' },
      language: 'pt-BR',
    });
    expect(codeOf(() => approve(h, started.row.id, 'reviewer-1', ADULT))).toBe('not_open');

    const done = uploaded();
    approve(h, done.id, 'reviewer-1', ADULT);
    expect(codeOf(() => approve(h, done.id, 'reviewer-1', ADULT))).toBe('not_open');

    expect(codeOf(() => approve(h, 'no-such-submission', 'reviewer-1', ADULT))).toBe('not_found');
  });

  it('nothing the reviewer typed is stored: no name, number or date of birth is in any file, the commitment is', () => {
    const { id } = uploaded();
    approve(h, id, 'reviewer-1', ADULT);

    // Positive control: the scan really reads the databases, so the commitment (which is stored) is found.
    expect(bytesContain(h.root, commitment(COMMITMENT_KEY, ADULT))).toBe(true);
    // The typed values, in every form a reviewer could have typed them, are not.
    for (const typed of [
      'Maria da Silva',
      'MARIA DA SILVA',
      '123.456.789-09',
      '12345678909',
      '1990-07-23',
      '23/07/1990',
    ]) {
      expect(bytesContain(h.root, typed)).toBe(false);
    }
  });

  it('queues the event once per outcome: a second decision is refused and a re-queue adds no row', () => {
    const { id } = uploaded();
    approve(h, id, 'reviewer-1', ADULT);
    expect(codeOf(() => approve(h, id, 'reviewer-1', ADULT))).toBe('not_open');
    expect(outboxFor(eventIdFor(id, 'approved'))).toBe(1);

    const payload = h.state.stores.outbox.payloadOf(eventIdFor(id, 'approved'));
    expect(payload).toBeDefined();
    expect(h.state.stores.outbox.enqueue(payload as NonNullable<typeof payload>, h.now())).toBe(
      false,
    );
    expect(outboxFor(eventIdFor(id, 'approved'))).toBe(1);
  });
});

describe('claims and the retry rule', () => {
  it('holds a claim for its reviewer: another reviewer cannot decide it, the holder can', () => {
    const { id } = uploaded();
    claimSubmission(h.state, id, 'reviewer-1');
    claimSubmission(h.state, id, 'reviewer-1');
    expect(h.state.stores.submissions.byId(id)?.status).toBe('claimed');
    expect(codeOf(() => decideApprove(h.state, id, 'reviewer-2', ADULT))).toBe('claimed_by_other');
    expect(codeOf(() => claimSubmission(h.state, id, 'reviewer-2'))).toBe('not_open');
    expect(codeOf(() => decideApprove(h.state, id, 'reviewer-1', ADULT))).toBe('none');
  });

  it('never gives a retry to the reviewer who refused the sending before it', () => {
    const first = uploaded();
    reject(h, first.id, 'reviewer-1', 'face_mismatch');

    const retry = uploaded({ retryOf: first.providerReference });
    expect(codeOf(() => claimSubmission(h.state, retry.id, 'reviewer-1'))).toBe('same_reviewer');
    expect(codeOf(() => approve(h, retry.id, 'reviewer-1', ADULT))).toBe('same_reviewer');
    expect(codeOf(() => reject(h, retry.id, 'reviewer-1', 'other'))).toBe('same_reviewer');
    expect(h.state.stores.submissions.byId(retry.id)?.status).toBe('uploaded');

    expect(codeOf(() => approve(h, retry.id, 'reviewer-2', ADULT))).toBe('none');
  });

  it('looks at the whole retry chain: a reviewer who refused an earlier sending of the chain is still refused', () => {
    const first = uploaded();
    reject(h, first.id, 'reviewer-1', 'document_unreadable');
    const second = uploaded({ retryOf: first.providerReference });
    reject(h, second.id, 'reviewer-2', 'document_not_original');
    const third = uploaded({ retryOf: second.providerReference });

    expect(codeOf(() => approve(h, third.id, 'reviewer-1', ADULT))).toBe('same_reviewer');
    expect(codeOf(() => approve(h, third.id, 'reviewer-2', ADULT))).toBe('same_reviewer');
    expect(codeOf(() => approve(h, third.id, 'reviewer-3', ADULT))).toBe('none');
  });
});

describe('rejection', () => {
  it('refuses with a reason a reviewer may choose, destroys the images and queues the event', () => {
    const { id } = uploaded();
    reject(h, id, 'reviewer-1', 'face_mismatch');
    const row = h.state.stores.submissions.byId(id);
    expect(row?.status).toBe('rejected');
    expect(row?.blobsJson).toBeNull();
    expect(h.state.stores.keys.get(id)).toBeUndefined();
    expect(h.state.stores.outbox.payloadOf(eventIdFor(id, 'rejected'))).toEqual({
      type: 'verification.rejected',
      eventId: eventIdFor(id, 'rejected'),
      verificationId: row?.verificationId,
      providerReference: row?.providerReference,
      decidedAt: new Date(T0).toISOString(),
      reason: 'face_mismatch',
      discardedAt: new Date(T0).toISOString(),
    });
    expect(h.state.stores.audit.forSubmission(id).map((entry) => entry.action)).toEqual([
      'claim',
      'reject',
    ]);
  });

  it('refuses the reason document_reused, which only the service itself may find', () => {
    const { id } = uploaded();
    expect(codeOf(() => decideReject(h.state, id, 'reviewer-1', 'document_reused'))).toBe(
      'reason_not_selectable',
    );
    expect(h.state.stores.submissions.byId(id)?.status).toBe('uploaded');
  });

  it('allows the underage refusal, which is how an underage holder is turned away', () => {
    const { id } = uploaded();
    expect(
      codeOf(() => approve(h, id, 'reviewer-1', { ...ADULT, dateOfBirth: '2012-01-01' })),
    ).toBe('underage');
    reject(h, id, 'reviewer-1', 'underage');
    expect(h.state.stores.outbox.payloadOf(eventIdFor(id, 'rejected'))).toMatchObject({
      reason: 'underage',
    });
  });
});

describe('expiry', () => {
  it('ends every open sending past its offer, destroys it and queues one expired event each, once', () => {
    const pending = startVerification(h.state, {
      verificationId: 'v-old-pending',
      subject: { userId: 'user-4', username: 'dani' },
      language: 'pt-BR',
    });
    const old = uploaded();
    const decided = uploaded();
    reject(h, decided.id, 'reviewer-1', 'other');

    h.setNow(T0 + 30 * DAY - 1);
    expect(expireOverdue(h.state)).toBe(0);
    expect(h.state.stores.submissions.byId(old.id)?.status).toBe('uploaded');

    h.setNow(T0 + 30 * DAY + 1);
    expect(expireOverdue(h.state)).toBe(2);
    expect(expireOverdue(h.state)).toBe(0);

    for (const id of [pending.row.id, old.id]) {
      const row = h.state.stores.submissions.byId(id);
      expect(row?.status).toBe('expired');
      expect(row?.blobsJson).toBeNull();
      expect(h.state.stores.keys.get(id)).toBeUndefined();
      expect(outboxFor(eventIdFor(id, 'expired'))).toBe(1);
      expect(
        h.state.stores.audit.forSubmission(id).map((entry) => [entry.action, entry.reviewerId]),
      ).toEqual([['expire', null]]);
    }
    expect(h.state.stores.submissions.byId(decided.id)?.status).toBe('rejected');
  });

  it('does not expire a sending that was decided before its offer ran out', () => {
    const { id } = uploaded();
    approve(h, id, 'reviewer-1', ADULT);
    h.setNow(T0 + 60 * DAY);
    expect(expireOverdue(h.state)).toBe(0);
    expect(outboxFor(eventIdFor(id, 'expired'))).toBe(0);
  });
});

describe('a decision needs the claim', () => {
  /** What a refused decision on an unclaimed sending must leave behind: the same sending, its images and its key. */
  function expectUntouched(id: string): void {
    const row = h.state.stores.submissions.byId(id);
    expect(row?.status).toBe('uploaded');
    expect(row?.blobsJson).not.toBeNull();
    expect(h.state.stores.keys.get(id)).toBeDefined();
    expect(outboxFor(eventIdFor(id, 'approved'))).toBe(0);
    expect(outboxFor(eventIdFor(id, 'rejected'))).toBe(0);
    expect(h.state.stores.outbox.undeliveredCount()).toBe(0);
    expect(h.state.stores.audit.forSubmission(id).map((entry) => entry.action)).toEqual([]);
  }

  it('refuses to approve an uploaded sending nobody claimed, with not_claimed, and changes nothing', () => {
    const { id } = uploaded();
    expect(codeOf(() => decideApprove(h.state, id, 'reviewer-1', ADULT))).toBe('not_claimed');
    expectUntouched(id);
  });

  it('refuses to reject an uploaded sending nobody claimed, with not_claimed, and changes nothing', () => {
    const { id } = uploaded();
    expect(codeOf(() => decideReject(h.state, id, 'reviewer-1', 'face_mismatch'))).toBe(
      'not_claimed',
    );
    expectUntouched(id);
  });

  it('approves and rejects once the reviewer holds the claim', () => {
    const approved = uploaded();
    claimSubmission(h.state, approved.id, 'reviewer-1');
    expect(codeOf(() => decideApprove(h.state, approved.id, 'reviewer-1', ADULT))).toBe('none');
    expect(h.state.stores.submissions.byId(approved.id)?.status).toBe('approved');

    const rejected = uploaded();
    claimSubmission(h.state, rejected.id, 'reviewer-1');
    expect(codeOf(() => decideReject(h.state, rejected.id, 'reviewer-1', 'other'))).toBe('none');
    expect(h.state.stores.submissions.byId(rejected.id)?.status).toBe('rejected');
  });

  it('keeps the claim of the holder: a sending claimed by another reviewer is not decided, with claimed_by_other', () => {
    const { id } = uploaded();
    claimSubmission(h.state, id, 'reviewer-1');
    expect(codeOf(() => decideReject(h.state, id, 'reviewer-2', 'other'))).toBe('claimed_by_other');
    expect(h.state.stores.submissions.byId(id)?.status).toBe('claimed');
  });
});
