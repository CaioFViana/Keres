import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { ageVerifications, termsAcceptances, userRecoveryCodes, users } from '@/db/schema';
import { ageVerificationService } from '@/services/age-verification/AgeVerificationService';
import { registerUser, uploadTestStory } from '@test/helpers/app';
import {
  approvedEvent,
  enterRequiredMode,
  expiredEvent,
  leaveRequiredMode,
  pendingAccount,
  rejectedEvent,
  userRow,
} from '@test/helpers/ageVerificationAccounts';
import { postVerifierEvents } from '@test/helpers/ageVerificationEvents';
import { truncateAll } from '@test/helpers/database';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
});

/** Moves a user's sendings into the past: the creation, and the decision when there is one. */
async function ageSendings(userId: string, days: number) {
  await db
    .update(ageVerifications)
    .set({ createdAt: daysAgo(days), decidedAt: daysAgo(days) })
    .where(eq(ageVerifications.userId, userId));
}

const dependentsOf = async (userId: string) => ({
  recoveryCodes: await db
    .select()
    .from(userRecoveryCodes)
    .where(eq(userRecoveryCodes.userId, userId)),
  terms: await db.select().from(termsAcceptances).where(eq(termsAcceptances.userId, userId)),
  sendings: await db.select().from(ageVerifications).where(eq(ageVerifications.userId, userId)),
});

describe('pruneAbandoned: accounts nobody completed', () => {
  it('deletes a pending account past the window completely, and cancels its submission at the service', async () => {
    const fake = enterRequiredMode({ withCancel: true });
    const stale = await pendingAccount('stale');
    await ageSendings(stale.user.userId, 31);
    const before = await dependentsOf(stale.user.userId);
    expect(before.recoveryCodes.length).toBeGreaterThan(0);
    expect(before.terms.length).toBeGreaterThan(0);
    expect(before.sendings).toHaveLength(1);

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome).toEqual({ accountsDeleted: 1, accountsRefused: 0, sendingsDeleted: 0 });
    expect(await userRow(stale.user.userId)).toBeUndefined();
    expect(await dependentsOf(stale.user.userId)).toEqual({
      recoveryCodes: [],
      terms: [],
      sendings: [],
    });
    expect(fake.cancelVerification).toHaveBeenCalledWith(stale.row.providerReference);
  });

  it('still deletes the account when the service cannot be told to cancel', async () => {
    const fake = enterRequiredMode({ withCancel: true });
    fake.state.cancelFails = true;
    const stale = await pendingAccount('stale');
    await ageSendings(stale.user.userId, 31);

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome.accountsDeleted).toBe(1);
    expect(await userRow(stale.user.userId)).toBeUndefined();
  });

  it('keeps a pending account still inside the window', async () => {
    enterRequiredMode({ withCancel: true });
    const fresh = await pendingAccount('fresh');

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome).toEqual({ accountsDeleted: 0, accountsRefused: 0, sendingsDeleted: 0 });
    expect(await userRow(fresh.user.userId)).toMatchObject({ verificationStatus: 'pending' });
  });

  it('refuses to delete a pending account that holds a story, and leaves it in place', async () => {
    // An account that made a story while it was active; verification then starts for it, and it waits.
    const stale = await registerUser('stale');
    const story = await uploadTestStory(stale.token, 'Rascunho');
    enterRequiredMode({ withCancel: true });
    await ageVerificationService.startVerification({
      userId: stale.userId,
      username: stale.username,
      language: 'pt',
    });
    await ageSendings(stale.userId, 31);

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome).toEqual({ accountsDeleted: 0, accountsRefused: 1, sendingsDeleted: 0 });
    expect(await userRow(stale.userId)).toBeDefined();
    const stories = await db.query.stories.findFirst({
      where: (table, { eq: equals }) => equals(table.id, story.id),
    });
    expect(stories).toBeDefined();
  });

  it('deletes a refused account past the window too, and keeps one still inside it', async () => {
    enterRequiredMode({ withCancel: true });
    const old = await pendingAccount('old');
    await postVerifierEvents([rejectedEvent(old.row, 'face_mismatch')]);
    await ageSendings(old.user.userId, 31);
    const recent = await pendingAccount('recent');
    await postVerifierEvents([expiredEvent(recent.row)]);

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome.accountsDeleted).toBe(1);
    expect(await userRow(old.user.userId)).toBeUndefined();
    expect(await userRow(recent.user.userId)).toBeDefined();
  });

  it('keeps an account whose approval is on record, even when its standing says otherwise', async () => {
    enterRequiredMode({ withCancel: true });
    const ana = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(ana.row)]);
    // Not reachable through the events alone: an approved account that somehow reads as rejected must not be removed.
    await db
      .update(users)
      .set({ verificationStatus: 'rejected' })
      .where(eq(users.id, ana.user.userId));
    await ageSendings(ana.user.userId, 40);

    const outcome = await ageVerificationService.pruneAbandoned(new Date());

    expect(outcome).toEqual({ accountsDeleted: 0, accountsRefused: 1, sendingsDeleted: 0 });
    expect(await userRow(ana.user.userId)).toBeDefined();
  });
});

describe('pruneAbandoned: refusals of accounts that are in', () => {
  it('deletes the refused sendings of an active account after 30 days, and keeps the recent ones', async () => {
    enterRequiredMode({ withCancel: true });
    const ana = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(ana.row, 'face_mismatch')]);
    const retry = await ageVerificationService.retry(ana.user.userId, 'pt');
    await postVerifierEvents([approvedEvent(retry.row)]);
    expect(await userRow(ana.user.userId)).toMatchObject({ verificationStatus: 'active' });

    // Within the window: the refusal stays.
    expect(await ageVerificationService.pruneAbandoned(new Date())).toEqual({
      accountsDeleted: 0,
      accountsRefused: 0,
      sendingsDeleted: 0,
    });
    // Past it: the refusal goes, the approval stays, and the account is untouched.
    const later = new Date(Date.now() + 31 * DAY);
    const outcome = await ageVerificationService.pruneAbandoned(later);

    expect(outcome).toEqual({ accountsDeleted: 0, accountsRefused: 0, sendingsDeleted: 1 });
    const rows = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.userId, ana.user.userId));
    expect(rows.map((row) => row.status)).toEqual(['approved']);
    expect(await userRow(ana.user.userId)).toMatchObject({
      verificationStatus: 'active',
      isAdultVerified: true,
    });
  });
});
