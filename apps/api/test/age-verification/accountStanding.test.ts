import { describe, expect, it } from 'vitest';
import type { AgeVerificationRow } from '@/services/age-verification/ageVerificationStatus';
import { accountStatusOf, isLapsed } from '@/services/age-verification/ageVerificationStatus';

const MAX = 3;
const NOW = new Date('2026-06-01T12:00:00Z');
const REDIRECT = { kind: 'redirect' as const, url: 'https://verify.example.test/v/abc' };

/** A sending row as the database returns it, with only what the standing rules read being of interest. */
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
    createdAt: new Date('2026-05-01T00:00:00Z'),
    expiresAt: null,
    decidedAt: null,
    discardedAt: null,
    ...over,
  } as AgeVerificationRow;
}

describe('a sending the service still holds open, past its time', () => {
  it('reads as expired at once, with a retry allowed while attempts remain (lazy expiry)', () => {
    const lapsed = sending({ expiresAt: new Date('2026-06-01T11:59:59Z') });

    expect(isLapsed(lapsed, NOW)).toBe(true);
    expect(
      accountStatusOf({ userStatus: 'pending', latest: lapsed, maxAttempts: MAX, now: NOW }),
    ).toEqual({
      status: 'expired',
      canRetry: true,
    });
  });

  it('does not allow a retry once the attempts are used up', () => {
    const lapsed = sending({ attempt: MAX, expiresAt: new Date('2026-06-01T11:00:00Z') });

    expect(
      accountStatusOf({ userStatus: 'pending', latest: lapsed, maxAttempts: MAX, now: NOW }),
    ).toEqual({
      status: 'expired',
      canRetry: false,
    });
  });

  it('is still pending, with its action, while its time has not run out', () => {
    const open = sending({ expiresAt: new Date('2026-06-02T12:00:00Z') });

    expect(isLapsed(open, NOW)).toBe(false);
    expect(
      accountStatusOf({ userStatus: 'pending', latest: open, maxAttempts: MAX, now: NOW }),
    ).toEqual({
      status: 'pending',
      action: REDIRECT,
      expiresAt: '2026-06-02T12:00:00.000Z',
    });
  });

  it('is never lapsed when it has no expiry, or has been decided', () => {
    expect(isLapsed(sending({ expiresAt: null }), NOW)).toBe(false);
    expect(
      isLapsed(sending({ status: 'expired', expiresAt: new Date('2026-01-01T00:00:00Z') }), NOW),
    ).toBe(false);
  });
});

describe('an approval that was revoked since', () => {
  const approved = sending({
    status: 'approved',
    actionJson: null,
    method: 'manual-document-live-photo',
  });

  it('reads as an active, unverified account: not_required, with nothing to do', () => {
    expect(
      accountStatusOf({
        userStatus: 'active',
        latest: approved,
        maxAttempts: MAX,
        adultVerified: false,
      }),
    ).toEqual({ status: 'not_required' });
  });

  it('reads as approved while the flag is on, and as approved when the caller does not say', () => {
    expect(
      accountStatusOf({
        userStatus: 'active',
        latest: approved,
        maxAttempts: MAX,
        adultVerified: true,
      }),
    ).toEqual({ status: 'approved' });
    expect(accountStatusOf({ userStatus: 'active', latest: approved, maxAttempts: MAX })).toEqual({
      status: 'approved',
    });
  });
});
