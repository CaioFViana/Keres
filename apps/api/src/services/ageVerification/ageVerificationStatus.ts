import { type AccountVerificationStatus, VerificationActionSchema } from '@keres/shared';
import type { VerificationRejectionReason } from '@keres/shared/age-verification/AgeVerificationConnector';
import type { ageVerifications, UserVerificationStatus } from '../../db/schema';

/**
 * What an account's standing says to the app (`AccountVerificationStatus`), worked out from the account and its latest
 * sending. Pure: the service reads the rows, this decides what they mean, and the tests can state the rules without a
 * database.
 */

export type AgeVerificationRow = typeof ageVerifications.$inferSelect;

/** A refused or expired sending may be sent again: within the attempt limit, and never after an `underage` refusal. */
export function canRetrySending(
  row: Pick<AgeVerificationRow, 'status' | 'attempt' | 'rejectionReason'>,
  maxAttempts: number,
): boolean {
  if (row.status !== 'rejected' && row.status !== 'expired') return false;
  if (row.rejectionReason === 'underage') return false;
  return row.attempt < maxAttempts;
}

export interface AccountStanding {
  userStatus: UserVerificationStatus;
  /** The account's newest sending, if it ever sent one. */
  latest: AgeVerificationRow | undefined;
  maxAttempts: number;
  /**
   * Whether the account is adults-only verified right now (`effectiveAdultVerified`): a revoked approval reads so.
   * Not given: the approval reads as an approval, as it always did (the callers that can revoke pass it).
   */
  adultVerified?: boolean;
  /** The instant the answer is for; a sending past its `expiresAt` is expired (see `isLapsed`). */
  now?: Date;
}

/**
 * A sending the service still holds as open, but whose offer has run out. The service reports the expiry as an event
 * too, but that can arrive late: the account reads it as expired at once, and may send again.
 */
export function isLapsed(
  row: Pick<AgeVerificationRow, 'status' | 'expiresAt'>,
  now: Date,
): boolean {
  return row.status === 'pending' && !!row.expiresAt && row.expiresAt.getTime() <= now.getTime();
}

/**
 * The standing an account shows. An account that never sent anything is `not_required` - which is every account where
 * verification is off, and every account made before it existed. A `pending` account with no sending on record is
 * reported as `pending` without an action: that should not happen, and it says so rather than inventing one.
 */
export function accountStatusOf({
  userStatus,
  latest,
  maxAttempts,
  adultVerified = true,
  now = new Date(),
}: AccountStanding): AccountVerificationStatus {
  if (!latest) {
    if (userStatus === 'pending') return { status: 'pending' };
    if (userStatus === 'rejected') return { status: 'rejected', canRetry: false };
    return { status: 'not_required' };
  }
  if (isLapsed(latest, now)) {
    return {
      status: 'expired',
      canRetry: canRetrySending({ ...latest, status: 'expired' }, maxAttempts),
    };
  }
  switch (latest.status) {
    case 'pending': {
      const action = VerificationActionSchema.safeParse(latest.actionJson);
      return {
        status: 'pending',
        ...(action.success ? { action: action.data } : {}),
        ...(latest.expiresAt ? { expiresAt: latest.expiresAt.toISOString() } : {}),
      };
    }
    case 'approved':
      // Nothing secret about an approval: the app only needs to know it happened. A revoked approval (the flag is
      // off again) is an active, unverified account: nothing is asked of the person, so there is no action to show.
      return { status: adultVerified ? 'approved' : 'not_required' };
    case 'rejected':
      return {
        status: 'rejected',
        ...(latest.rejectionReason
          ? { reason: latest.rejectionReason as VerificationRejectionReason }
          : {}),
        canRetry: canRetrySending(latest, maxAttempts),
      };
    case 'expired':
      return { status: 'expired', canRetry: canRetrySending(latest, maxAttempts) };
    case 'canceled':
      // A sending the server itself cancelled (the account is being closed): nothing to send again.
      return { status: 'expired', canRetry: false };
  }
}

/** The instant a sending's standing began: its creation while it is open, its decision once it has one. */
export function standingSince(
  row: Pick<AgeVerificationRow, 'status' | 'createdAt' | 'decidedAt'>,
): Date {
  if (row.status === 'pending' || !row.decidedAt) return row.createdAt;
  return row.decidedAt;
}
