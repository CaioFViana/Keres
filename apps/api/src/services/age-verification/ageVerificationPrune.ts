import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { AgeVerifier } from '@keres/shared/age-verification/AgeVerificationConnector';
import { env } from '@/config/env';
import { type CompatibleDb, db, withWriteTransaction } from '@/db';
import {
  ageVerifications,
  comments,
  favorites,
  friendships,
  messageLog,
  messages,
  operationLog,
  packs,
  paymentCheckouts,
  paymentSubscriptions,
  playPurchaseClaims,
  storyInvitations,
  storyPermissions,
  storyPublications,
  storyShowcaseEntries,
  stories,
  termsAcceptances,
  userRecoveryCodes,
  users,
} from '@/db/schema';
import { logger } from '@/utils/logger';
import { auditService } from '@/services/compliance/AuditService';
import { type AgeVerificationRow, standingSince } from './ageVerificationStatus';

/**
 * The housekeeping of age verification (see `docs/compliance/age_verification.md`): accounts that nobody completed, and the refusals
 * of accounts that are in. Nothing here is scheduled - the caller decides when it runs.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a refused or expired sending of an active account is kept: the window to try again. */
export const REFUSED_SENDING_KEEP_DAYS = 30;

export interface PruneOutcome {
  /** Accounts that were deleted completely. */
  accountsDeleted: number;
  /** Accounts that were old enough but were kept: they hold content, money, or an approval. */
  accountsRefused: number;
  /** Refused or expired sendings of active accounts that were deleted. */
  sendingsDeleted: number;
}

/**
 * Deletes the accounts that were left pending or refused for longer than `AGE_VERIFICATION_PENDING_DAYS`, and the
 * refused sendings of active accounts older than 30 days. An account that holds anything beyond what registration
 * creates (stories, invitations, publications, plans, payments, an approval) is never deleted here: it is counted in
 * `accountsRefused` and logged, and it is left for an administrator.
 */
export async function pruneAbandonedAccounts(
  now: Date,
  verifier: AgeVerifier | null,
): Promise<PruneOutcome> {
  const cutoff = new Date(now.getTime() - env.AGE_VERIFICATION_PENDING_DAYS * DAY_MS);
  const outcome: PruneOutcome = { accountsDeleted: 0, accountsRefused: 0, sendingsDeleted: 0 };

  const candidates = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(inArray(users.verificationStatus, ['pending', 'rejected']));

  for (const candidate of candidates) {
    const sendings = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, candidate.id))
      .orderBy(desc(ageVerifications.createdAt), desc(ageVerifications.id));
    const latest: AgeVerificationRow | undefined = sendings[0];
    const since = latest ? standingSince(latest) : candidate.createdAt;
    if (since.getTime() >= cutoff.getTime()) continue;

    if (sendings.some((sending) => sending.status === 'approved')) {
      // An approval is the proof kept for the account (its commitment): never removed with the account.
      outcome.accountsRefused += 1;
      logger.warn('An age-verification account with an approval was left out of the cleanup.');
      continue;
    }
    if (await holdsContent(candidate.id)) {
      outcome.accountsRefused += 1;
      logger.warn('An abandoned age-verification account holds content and was left in place.');
      continue;
    }

    // The service is told to destroy what it still holds. Best effort: a service that is down keeps its submission
    // until its own expiry, and an event that later arrives for a deleted sending is recorded as unknown.
    if (verifier?.cancelVerification) {
      for (const sending of sendings) {
        if (sending.status !== 'pending') continue;
        try {
          await verifier.cancelVerification(sending.providerReference);
        } catch (error) {
          logger.warn(
            `The age-verification service did not cancel an abandoned submission (${error instanceof Error ? error.message : String(error)}).`,
          );
        }
      }
    }

    const deleted = await deleteAccount(candidate.id);
    if (!deleted) {
      outcome.accountsRefused += 1;
      continue;
    }
    outcome.accountsDeleted += 1;
    try {
      // The record keeps its lines but loses the account's ids and addresses, as for a closed account.
      await auditService.scrubUser(candidate.id);
    } catch (error) {
      logger.warn(
        `The activity record of a deleted age-verification account was not scrubbed (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }

  const keepUntil = new Date(now.getTime() - REFUSED_SENDING_KEEP_DAYS * DAY_MS);
  const stale = await db
    .select({ id: ageVerifications.id })
    .from(ageVerifications)
    .innerJoin(users, eq(users.id, ageVerifications.userId))
    .where(
      and(
        eq(users.verificationStatus, 'active'),
        inArray(ageVerifications.status, ['rejected', 'expired']),
        or(
          lt(ageVerifications.decidedAt, keepUntil),
          and(isNull(ageVerifications.decidedAt), lt(ageVerifications.createdAt, keepUntil)),
        ),
      ),
    );
  if (stale.length > 0) {
    await db.delete(ageVerifications).where(
      inArray(
        ageVerifications.id,
        stale.map((row) => row.id),
      ),
    );
    outcome.sendingsDeleted = stale.length;
  }

  return outcome;
}

/**
 * Whether the account has anything a registration does not create: stories, what they are shared with, what was
 * published or shown, its comments and edit history, a plan or a payment, and a store purchase it relayed.
 */
async function holdsContent(userId: string): Promise<boolean> {
  const found = await Promise.all([
    db.select({ id: stories.id }).from(stories).where(eq(stories.userId, userId)).limit(1),
    db
      .select({ id: storyPermissions.id })
      .from(storyPermissions)
      .where(eq(storyPermissions.userId, userId))
      .limit(1),
    db
      .select({ id: storyInvitations.id })
      .from(storyInvitations)
      .where(or(eq(storyInvitations.inviterId, userId), eq(storyInvitations.inviteeId, userId)))
      .limit(1),
    db
      .select({ id: storyPublications.id })
      .from(storyPublications)
      .where(eq(storyPublications.ownerUserId, userId))
      .limit(1),
    db
      .select({ id: storyShowcaseEntries.storyId })
      .from(storyShowcaseEntries)
      .where(eq(storyShowcaseEntries.ownerUserId, userId))
      .limit(1),
    db.select({ id: packs.id }).from(packs).where(eq(packs.ownerId, userId)).limit(1),
    db.select({ id: comments.id }).from(comments).where(eq(comments.authorUserId, userId)).limit(1),
    db
      .select({ id: operationLog.id })
      .from(operationLog)
      .where(eq(operationLog.userId, userId))
      .limit(1),
    db
      .select({ userId: paymentSubscriptions.userId })
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, userId))
      .limit(1),
    db
      .select({ id: paymentCheckouts.id })
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.userId, userId))
      .limit(1),
    db
      .select({ key: playPurchaseClaims.purchaseTokenHash })
      .from(playPurchaseClaims)
      .where(eq(playPurchaseClaims.userId, userId))
      .limit(1),
  ]);
  return found.some((rows) => rows.length > 0);
}

/**
 * Removes the account and everything that refers to it, in one transaction. Returns false (and removes nothing) when
 * an approval turned up after the check: the account is then not abandoned after all.
 */
async function deleteAccount(userId: string): Promise<boolean> {
  return withWriteTransaction(async (tx: CompatibleDb) => {
    const approved = await tx.query.ageVerifications.findFirst({
      where: and(eq(ageVerifications.userId, userId), eq(ageVerifications.status, 'approved')),
      columns: { id: true },
    });
    if (approved) return false;

    await tx.delete(ageVerifications).where(eq(ageVerifications.userId, userId));
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
    await tx.delete(termsAcceptances).where(eq(termsAcceptances.userId, userId));
    await tx.delete(favorites).where(eq(favorites.userId, userId));
    await tx
      .delete(friendships)
      .where(or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)));
    await tx
      .update(friendships)
      .set({ blockedById: null })
      .where(eq(friendships.blockedById, userId));
    await tx
      .delete(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)));
    await tx
      .update(messages)
      .set({ sentByAdminId: null })
      .where(eq(messages.sentByAdminId, userId));
    await tx.delete(messageLog).where(eq(messageLog.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
}
