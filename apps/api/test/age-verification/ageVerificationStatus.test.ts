import { describe, expect, it } from 'vitest';
import type { AgeVerificationRow } from '@/services/age-verification/ageVerificationStatus';
import {
  accountStatusOf,
  canRetrySending,
  standingSince,
} from '@/services/age-verification/ageVerificationStatus';
import { toVerificationEvent } from '@/services/age-verification/verificationEvents';

const MAX = 3;
const REDIRECT = { kind: 'redirect' as const, url: 'https://verify.example.test/v/abc' };

/** A sending row as the database returns it, with only what a rule reads being of interest. */
function sending(over: Partial<AgeVerificationRow> = {}): AgeVerificationRow {
  return {
    id: 'ver_1',
    userId: 'user_1',
    verifierId: 'fakeverify',
    providerReference: 'ref_1',
    status: 'pending',
    attempt: 1,
    retryOf: null,
    method: null,
    identityCommitment: null,
    rejectionReason: null,
    actionJson: REDIRECT,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    decidedAt: null,
    discardedAt: null,
    ...over,
  } as AgeVerificationRow;
}

describe('canRetrySending', () => {
  it('allows a new sending after a refusal or an expiry, while attempts remain', () => {
    expect(canRetrySending(sending({ status: 'rejected', attempt: 1 }), MAX)).toBe(true);
    expect(canRetrySending(sending({ status: 'expired', attempt: 2 }), MAX)).toBe(true);
  });

  it('refuses once the attempt limit is reached', () => {
    expect(canRetrySending(sending({ status: 'rejected', attempt: MAX }), MAX)).toBe(false);
  });

  it('never allows a retry after an underage refusal, whatever the attempt', () => {
    expect(
      canRetrySending(
        sending({ status: 'rejected', attempt: 1, rejectionReason: 'underage' }),
        MAX,
      ),
    ).toBe(false);
  });

  it('never allows a retry of an open, approved or cancelled sending', () => {
    expect(canRetrySending(sending({ status: 'pending' }), MAX)).toBe(false);
    expect(canRetrySending(sending({ status: 'approved' }), MAX)).toBe(false);
    expect(canRetrySending(sending({ status: 'canceled' }), MAX)).toBe(false);
  });
});

describe('accountStatusOf', () => {
  it('is not_required for an active account that never sent anything', () => {
    expect(accountStatusOf({ userStatus: 'active', latest: undefined, maxAttempts: MAX })).toEqual({
      status: 'not_required',
    });
  });

  it('shows a pending account with its action and expiry, and no retry', () => {
    // Still open: a fixed past date would now read as lapsed (see `isLapsed`), so the date is kept in the future.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(
      accountStatusOf({
        userStatus: 'pending',
        latest: sending({ expiresAt }),
        maxAttempts: MAX,
      }),
    ).toEqual({ status: 'pending', action: REDIRECT, expiresAt: expiresAt.toISOString() });
  });

  it('says nothing secret about an approval', () => {
    expect(
      accountStatusOf({
        userStatus: 'active',
        latest: sending({ status: 'approved', method: 'manual-document-live-photo' }),
        maxAttempts: MAX,
      }),
    ).toEqual({ status: 'approved' });
  });

  it('gives the reason and whether a retry is allowed for a refusal', () => {
    expect(
      accountStatusOf({
        userStatus: 'rejected',
        latest: sending({ status: 'rejected', rejectionReason: 'face_mismatch', attempt: 1 }),
        maxAttempts: MAX,
      }),
    ).toEqual({ status: 'rejected', reason: 'face_mismatch', canRetry: true });
  });

  it('reports an underage refusal as closed for good: no retry', () => {
    expect(
      accountStatusOf({
        userStatus: 'rejected',
        latest: sending({ status: 'rejected', rejectionReason: 'underage' }),
        maxAttempts: MAX,
      }),
    ).toEqual({ status: 'rejected', reason: 'underage', canRetry: false });
  });

  it('reports an expiry with whether it may be sent again', () => {
    expect(
      accountStatusOf({
        userStatus: 'rejected',
        latest: sending({ status: 'expired', attempt: MAX }),
        maxAttempts: MAX,
      }),
    ).toEqual({ status: 'expired', canRetry: false });
  });

  it('does not invent an action for a pending sending whose stored action is unreadable', () => {
    const status = accountStatusOf({
      userStatus: 'pending',
      latest: sending({ actionJson: { kind: 'nonsense' } }),
      maxAttempts: MAX,
    });
    expect(status).toEqual({ status: 'pending' });
  });

  it('reports a pending account with no sending on record as pending, without an action', () => {
    expect(accountStatusOf({ userStatus: 'pending', latest: undefined, maxAttempts: MAX })).toEqual(
      { status: 'pending' },
    );
  });
});

describe('standingSince', () => {
  it('is the creation while the sending is open, and the decision once it has one', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const decided = new Date('2026-01-05T00:00:00Z');
    expect(standingSince(sending({ createdAt: created }))).toEqual(created);
    expect(
      standingSince(sending({ status: 'rejected', createdAt: created, decidedAt: decided })),
    ).toEqual(decided);
    expect(
      standingSince(sending({ status: 'rejected', createdAt: created, decidedAt: null })),
    ).toEqual(created);
  });
});

describe('toVerificationEvent', () => {
  it('turns the dates of an approval into dates, and keeps the commitment and method', () => {
    const event = toVerificationEvent({
      type: 'verification.approved',
      eventId: 'evt_1',
      verificationId: 'ver_1',
      providerReference: 'ref_1',
      decidedAt: '2026-01-02T10:00:00.000Z',
      method: 'manual-document-live-photo',
      identityCommitment: 'a'.repeat(64),
      discardedAt: '2026-01-02T10:00:01.000Z',
    });
    expect(event).toEqual({
      type: 'verification.approved',
      eventId: 'evt_1',
      verificationId: 'ver_1',
      providerReference: 'ref_1',
      decidedAt: new Date('2026-01-02T10:00:00.000Z'),
      method: 'manual-document-live-photo',
      identityCommitment: 'a'.repeat(64),
      discardedAt: new Date('2026-01-02T10:00:01.000Z'),
    });
  });

  it('leaves out an expiry reference the service did not send', () => {
    const event = toVerificationEvent({
      type: 'verification.expired',
      eventId: 'evt_2',
      verificationId: 'ver_1',
      discardedAt: '2026-01-02T10:00:00.000Z',
    });
    expect(event).not.toHaveProperty('providerReference');
    expect(event).toMatchObject({ type: 'verification.expired', verificationId: 'ver_1' });
  });
});
