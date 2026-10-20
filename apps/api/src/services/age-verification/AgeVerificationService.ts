import type { AccountVerificationStatus } from '@keres/shared';
import type {
  VerificationAction,
  VerificationEvent,
  VerificationRejectionReason,
} from '@keres/shared/age-verification/AgeVerificationConnector';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '@/config/env';
import { type CompatibleDb, db, withWriteTransaction } from '@/db';
import {
  type StoredAgeVerificationEventOutcome,
  ageVerificationEvents,
  ageVerifications,
  users,
} from '@/db/schema';
import { logger } from '@/utils/logger';
import { auditService } from '@/services/compliance/AuditService';
import { storyNsfwService } from '@/services/stories/StoryNsfwService';
import { getAgeVerifier } from './AgeVerifierRegistry';
import { effectiveAdultVerified, isAgeVerificationRequired } from './ageVerificationMode';
import { pruneAbandonedAccounts, type PruneOutcome } from './ageVerificationPrune';
import {
  type AgeVerificationRow,
  accountStatusOf,
  canRetrySending,
  isLapsed,
} from './ageVerificationStatus';

/**
 * Age verification on the Keres server (see `docs/compliance/age_verification.md`): a sending of a document to the operator's
 * verification service, the service's decisions as they come back as signed events, the standing of each account, and
 * the removal of the adults-only area when a verification is revoked. The document itself never reaches this code.
 *
 * Registration calls the service before it creates the account (`requestFromVerifier`), then records the sending in the
 * same transaction as the account (`recordPending`); `startVerification` does both for an account that exists.
 */

/** What an event did, as the route reports it. A duplicate is the same fact arriving again: applied once. */
export type EventOutcome = 'applied' | 'duplicate' | 'unknown' | 'ignored';

/** No service is connected, or it refused to start a sending. Nothing was recorded: no account goes unchecked. */
export class VerificationUnavailableError extends Error {
  constructor() {
    super('Age verification is unavailable on this server.');
    this.name = 'VerificationUnavailableError';
  }
}

/** The account may not send again: not pending or refused, the last sending is not refused or expired, or no more attempts. */
export class VerificationRetryNotAllowedError extends Error {
  constructor() {
    super('This account cannot send a new document for verification.');
    this.name = 'VerificationRetryNotAllowedError';
  }
}

export class AgeVerificationUserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'AgeVerificationUserNotFoundError';
  }
}

export interface SendingRequest {
  userId: string;
  username: string;
  language: string;
  /** The service's reference of the sending this one retries (a refused or expired one). */
  retryOf?: string;
}

/** A sending the service has accepted, not yet recorded here. */
export interface RequestedSending {
  /** Keres' verification id: the row's id, and the id the service names in its events. */
  id: string;
  userId: string;
  verifierId: string;
  providerReference: string;
  action: VerificationAction;
  expiresAt?: Date;
  retryOf?: string;
}

export interface StartedSending {
  row: AgeVerificationRow;
  status: AccountVerificationStatus;
}

export class AgeVerificationService {
  /**
   * Asks the connected service to start a sending. Nothing is written here: a service that is missing or fails makes it
   * `VerificationUnavailableError`, and the caller creates nothing.
   */
  async requestFromVerifier(request: SendingRequest): Promise<RequestedSending> {
    const verifier = getAgeVerifier();
    if (!verifier) throw new VerificationUnavailableError();

    // The id is made first: it is the service's idempotency key, and it is the row's id once the row is written.
    const id = ulid();
    try {
      const result = await verifier.createVerification({
        verificationId: id,
        subject: { userId: request.userId, username: request.username },
        language: request.language,
        ...(request.retryOf ? { retryOf: request.retryOf } : {}),
      });
      return {
        id,
        userId: request.userId,
        verifierId: verifier.id,
        providerReference: result.providerReference,
        action: result.action,
        ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
        ...(request.retryOf ? { retryOf: request.retryOf } : {}),
      };
    } catch (error) {
      logger.warn(
        `The age-verification service did not start a verification (${error instanceof Error ? error.message : String(error)}).`,
      );
      throw new VerificationUnavailableError();
    }
  }

  /**
   * Writes an accepted sending as pending. Joins the caller's transaction when there is one, so registration can create
   * the account and its sending together.
   */
  async recordPending(sending: RequestedSending, attempt: number): Promise<AgeVerificationRow> {
    return withWriteTransaction(async (tx) => {
      const [row] = await tx
        .insert(ageVerifications)
        .values({
          id: sending.id,
          userId: sending.userId,
          verifierId: sending.verifierId,
          providerReference: sending.providerReference,
          status: 'pending',
          attempt,
          retryOf: sending.retryOf ?? null,
          actionJson: sending.action,
          expiresAt: sending.expiresAt ?? null,
        })
        .returning();
      return row!;
    });
  }

  /** Sends a document for an existing account: the account goes pending, and the sending is recorded. */
  async startVerification(request: SendingRequest): Promise<StartedSending> {
    const latest = await this.latestSending(request.userId);
    // A retry continues the count; the first sending of an account is attempt 1.
    const attempt = request.retryOf && latest ? latest.attempt + 1 : 1;
    const sending = await this.requestFromVerifier(request);
    return withWriteTransaction(async (tx) => {
      await tx
        .update(users)
        .set({ verificationStatus: 'pending', updatedAt: new Date() })
        .where(eq(users.id, request.userId));
      const row = await this.recordPending(sending, attempt);
      return {
        row,
        status: accountStatusOf({
          userStatus: 'pending',
          latest: row,
          maxAttempts: env.AGE_VERIFICATION_MAX_ATTEMPTS,
        }),
      };
    });
  }

  /**
   * A new sending after a refusal or an expiry: allowed while the account is pending or rejected, the last sending was
   * refused or expired, and the attempt limit is not reached. The new sending names the refused one, so another reviewer
   * looks at it.
   */
  async retry(userId: string, language: string): Promise<StartedSending> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, username: true, verificationStatus: true },
    });
    if (!user) throw new AgeVerificationUserNotFoundError();
    let latest = await this.latestSending(userId);
    if (latest && isLapsed(latest, new Date())) {
      // An offer that ran out is closed here before the next one starts: the late expiry event for it then changes
      // nothing, and the service is asked to destroy what it still holds (best effort).
      await db
        .update(ageVerifications)
        .set({ status: 'expired', actionJson: null })
        .where(eq(ageVerifications.id, latest.id));
      await this.cancelAtService(latest.providerReference);
      latest = { ...latest, status: 'expired', actionJson: null };
    }
    if (
      user.verificationStatus === 'active' ||
      !latest ||
      !canRetrySending(latest, env.AGE_VERIFICATION_MAX_ATTEMPTS)
    ) {
      throw new VerificationRetryNotAllowedError();
    }
    return this.startVerification({
      userId,
      username: user.username,
      language,
      retryOf: latest.providerReference,
    });
  }

  /** Where the account stands, for the app. Nothing secret is in it. */
  async statusFor(userId: string): Promise<AccountVerificationStatus> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { verificationStatus: true, isAdultVerified: true },
    });
    const latest = await this.latestSending(userId);
    return accountStatusOf({
      // A missing account reads as active: it has no sending and no standing to show.
      userStatus: user?.verificationStatus ?? 'active',
      latest,
      maxAttempts: env.AGE_VERIFICATION_MAX_ATTEMPTS,
      adultVerified: effectiveAdultVerified(user?.isAdultVerified ?? false),
    });
  }

  /**
   * Tells the service to destroy a sending nobody will decide - a registration that could not be completed after the
   * service accepted it. Best effort: a service that is down keeps the submission until its own expiry.
   */
  async cancelSending(sending: Pick<RequestedSending, 'providerReference'>): Promise<void> {
    await this.cancelAtService(sending.providerReference);
  }

  private async cancelAtService(providerReference: string): Promise<void> {
    const verifier = getAgeVerifier();
    if (!verifier?.cancelVerification) return;
    try {
      await verifier.cancelVerification(providerReference);
    } catch (error) {
      logger.warn(
        `The age-verification service did not cancel a sending (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }

  /**
   * Applies what a service reported, in the order given. Each event is applied once: the ledger row for it is written
   * first, so a second arrival is `duplicate` and changes nothing.
   */
  async applyEvents(
    verifierId: string,
    events: VerificationEvent[],
    now = new Date(),
  ): Promise<EventOutcome[]> {
    const outcomes: EventOutcome[] = [];
    for (const event of events) {
      outcomes.push(await this.applyEvent(verifierId, event, now));
    }
    return outcomes;
  }

  /**
   * Revokes an account's adults-only standing: the flag goes, and the account leaves every adults-only story it was in.
   * The sending records are kept - they are the proof of the earlier approval.
   */
  async revoke(userId: string, actorId?: string | null): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    if (!user) throw new AgeVerificationUserNotFoundError();
    await db
      .update(users)
      // The private adults-only preference goes with the verification: it never outlives it.
      .set({ isAdultVerified: false, showNsfw: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await storyNsfwService.removeUserFromNsfwStories(userId, 'verification-revoked');
    auditService.record({
      category: 'account',
      action: 'account.verification_revoked',
      outcome: 'success',
      actorUserId: actorId ?? null,
      subjectUserId: userId,
    });
  }

  /** Deletes the accounts abandoned in verification, and the old refusals of active accounts (see `ageVerificationPrune`). */
  async pruneAbandoned(now: Date = new Date()): Promise<PruneOutcome> {
    const outcome = await pruneAbandonedAccounts(now, getAgeVerifier());
    if (outcome.accountsDeleted > 0 || outcome.sendingsDeleted > 0) {
      logger.info(
        `Age verification cleanup: ${outcome.accountsDeleted} abandoned account(s) deleted, ${outcome.accountsRefused} kept, ${outcome.sendingsDeleted} old refusal(s) removed.`,
      );
    }
    return outcome;
  }

  /**
   * An account's own sendings, oldest first, for the data export. What happened and when: never the identity
   * commitment (it says nothing to the person) nor the service's reference.
   */
  async historyFor(userId: string) {
    const rows = await db.query.ageVerifications.findMany({
      where: eq(ageVerifications.userId, userId),
      orderBy: [asc(ageVerifications.createdAt), asc(ageVerifications.id)],
    });
    return rows.map((row) => ({
      attempt: row.attempt,
      status: row.status,
      method: row.method,
      rejectionReason: row.rejectionReason,
      sentAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      documentDiscardedAt: row.discardedAt?.toISOString() ?? null,
    }));
  }

  private async latestSending(userId: string): Promise<AgeVerificationRow | undefined> {
    return db.query.ageVerifications.findFirst({
      where: eq(ageVerifications.userId, userId),
      orderBy: [desc(ageVerifications.createdAt), desc(ageVerifications.id)],
    });
  }

  private async applyEvent(
    verifierId: string,
    event: VerificationEvent,
    now: Date,
  ): Promise<EventOutcome> {
    return withWriteTransaction(async (tx) => {
      // Claimed first: the ledger's key is what makes a second arrival of the same fact count once, and it is taken
      // before anything is read, so two arrivals at the same time cannot both apply.
      const claimed = await tx
        .insert(ageVerificationEvents)
        .values({ verifierId, eventId: event.eventId, outcome: 'ignored' })
        .onConflictDoNothing()
        .returning({ eventId: ageVerificationEvents.eventId });
      if (claimed.length === 0) return 'duplicate';

      const outcome = await this.decide(tx, verifierId, event, now);
      await tx
        .update(ageVerificationEvents)
        .set({ outcome })
        .where(
          and(
            eq(ageVerificationEvents.verifierId, verifierId),
            eq(ageVerificationEvents.eventId, event.eventId),
          ),
        );
      return outcome;
    });
  }

  private async decide(
    tx: CompatibleDb,
    verifierId: string,
    event: VerificationEvent,
    now: Date,
  ): Promise<StoredAgeVerificationEventOutcome> {
    const row = await tx.query.ageVerifications.findFirst({
      where: eq(ageVerifications.id, event.verificationId),
    });
    // Not a sending of this server, of this service, or not the one the event names: not a fact about anything here.
    if (!row || row.verifierId !== verifierId) return 'unknown';
    if (
      event.providerReference !== undefined &&
      event.providerReference !== row.providerReference
    ) {
      return 'unknown';
    }
    // A decision on a sending that was already decided or cancelled (an approval after a cancel, say) changes nothing.
    if (row.status !== 'pending') return 'ignored';
    const user = await tx.query.users.findFirst({
      where: eq(users.id, row.userId),
      columns: { id: true, isDeleted: true },
    });
    if (!user || user.isDeleted) return 'ignored';

    switch (event.type) {
      case 'verification.approved':
        return this.approve(tx, row, event, now);
      case 'verification.rejected':
        await this.refuse(tx, row, event.reason, event.decidedAt, event.discardedAt, now);
        return 'applied';
      case 'verification.expired':
        await tx
          .update(ageVerifications)
          .set({
            status: 'expired',
            actionJson: null,
            decidedAt: event.discardedAt,
            discardedAt: event.discardedAt,
          })
          .where(eq(ageVerifications.id, row.id));
        await this.markRejected(tx, row.userId, now);
        return 'applied';
    }
  }

  private async approve(
    tx: CompatibleDb,
    row: AgeVerificationRow,
    event: Extract<VerificationEvent, { type: 'verification.approved' }>,
    now: Date,
  ): Promise<StoredAgeVerificationEventOutcome> {
    // Where verification is off nobody counts as verified, whatever a service says.
    if (!isAgeVerificationRequired()) return 'ignored';

    // The same document may verify one account on this server only. The unique index is the backstop for a race; this
    // check is what gives the clear answer (the sending is refused, the event is applied as that refusal).
    const held = await tx.query.ageVerifications.findFirst({
      where: and(
        eq(ageVerifications.identityCommitment, event.identityCommitment),
        ne(ageVerifications.id, row.id),
      ),
      columns: { id: true },
    });
    if (held) {
      await this.refuse(tx, row, 'document_reused', event.decidedAt, event.discardedAt, now);
      return 'applied';
    }

    await tx
      .update(ageVerifications)
      .set({
        status: 'approved',
        method: event.method,
        identityCommitment: event.identityCommitment,
        rejectionReason: null,
        actionJson: null,
        decidedAt: event.decidedAt,
        discardedAt: event.discardedAt,
      })
      .where(eq(ageVerifications.id, row.id));
    await tx
      .update(users)
      .set({
        isAdultVerified: true,
        verificationStatus: 'active',
        verifiedAt: event.decidedAt,
        verificationMethod: event.method,
        updatedAt: now,
      })
      .where(eq(users.id, row.userId));
    return 'applied';
  }

  /**
   * A refusal. `underage` closes the account at once: a minor found here is not given a second try, and the account
   * is ended like one the person deleted (the soft-delete shape of `UserService.deleteOwnAccount`).
   */
  private async refuse(
    tx: CompatibleDb,
    row: AgeVerificationRow,
    reason: VerificationRejectionReason,
    decidedAt: Date,
    discardedAt: Date,
    now: Date,
  ): Promise<void> {
    await tx
      .update(ageVerifications)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        actionJson: null,
        decidedAt,
        discardedAt,
      })
      .where(eq(ageVerifications.id, row.id));
    await this.markRejected(tx, row.userId, now, reason === 'underage');
  }

  /** The account is refused: it may send again, unless it is closed (an underage refusal). */
  private async markRejected(
    tx: CompatibleDb,
    userId: string,
    now: Date,
    closed = false,
  ): Promise<void> {
    await tx
      .update(users)
      .set({
        verificationStatus: 'rejected',
        updatedAt: now,
        ...(closed ? { isDeleted: true, deletedAt: now } : {}),
      })
      .where(eq(users.id, userId));
  }
}

export const ageVerificationService = new AgeVerificationService();
