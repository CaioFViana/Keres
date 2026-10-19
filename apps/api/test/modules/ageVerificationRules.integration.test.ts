import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '@/config/env';
import { db } from '@/db';
import { ageVerificationEvents, ageVerifications, auditEvents, stories } from '@/db/schema';
import {
  AgeVerificationUserNotFoundError,
  ageVerificationService,
  VerificationRetryNotAllowedError,
  VerificationUnavailableError,
} from '@/services/age-verification/AgeVerificationService';
import { resetAgeVerifier } from '@/services/age-verification/AgeVerifierRegistry';
import { drainBackground } from '@/utils/backgroundWork';
import { registerUser, request, type TestUser, uploadTestStory } from '@test/helpers/app';
import {
  approvedEvent,
  commitmentFor,
  enterRequiredMode,
  expiredEvent,
  leaveRequiredMode,
  pendingAccount,
  rejectedEvent,
  userRow,
} from '@test/helpers/ageVerificationAccounts';
import { postVerifierEvents } from '@test/helpers/ageVerificationEvents';
import { truncateAll } from '@test/helpers/database';

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
});

const sendingsOf = (userId: string) =>
  db.select().from(ageVerifications).where(eq(ageVerifications.userId, userId));

const sendingById = (id: string) =>
  db.query.ageVerifications.findFirst({ where: eq(ageVerifications.id, id) });

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

/** The session an approved account gets from its own verification route: the pending one is refused everywhere else. */
async function activeSession(user: TestUser): Promise<string> {
  const { data } = await request('GET', '/auth/verification', { token: user.token });
  expect(data.session).toBeDefined();
  return data.session.accessToken as string;
}

describe('an identity document verifies one account on this server', () => {
  it('refuses a second approval with the same commitment, and stores the commitment once', async () => {
    enterRequiredMode();
    const ana = await pendingAccount('ana');
    const bia = await pendingAccount('bia');
    const shared = commitmentFor('the-same-document');

    await postVerifierEvents([approvedEvent(ana.row, { identityCommitment: shared })]);
    const answer = await postVerifierEvents([
      approvedEvent(bia.row, { identityCommitment: shared }),
    ]);

    expect(answer.data.outcomes[0].outcome).toBe('applied');
    expect(await userRow(bia.user.userId)).toMatchObject({
      verificationStatus: 'rejected',
      isAdultVerified: false,
    });
    expect(await sendingById(bia.row.id)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'document_reused',
      identityCommitment: null,
    });
    const holders = await db
      .select()
      .from(ageVerifications)
      .where(eq(ageVerifications.identityCommitment, shared));
    expect(holders.map((row) => row.userId)).toEqual([ana.user.userId]);
  });

  it('reports the refusal to the account, which can still send again', async () => {
    enterRequiredMode();
    const ana = await pendingAccount('ana');
    const bia = await pendingAccount('bia');
    const shared = commitmentFor('the-same-document');
    await postVerifierEvents([approvedEvent(ana.row, { identityCommitment: shared })]);
    await postVerifierEvents([approvedEvent(bia.row, { identityCommitment: shared })]);

    expect(await ageVerificationService.statusFor(bia.user.userId)).toEqual({
      status: 'rejected',
      reason: 'document_reused',
      canRetry: true,
    });
  });
});

describe('an underage refusal', () => {
  it('closes the account and gives no retry', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(row, 'underage')]);

    expect(await ageVerificationService.statusFor(user.userId)).toEqual({
      status: 'rejected',
      reason: 'underage',
      canRetry: false,
    });
    await expect(ageVerificationService.retry(user.userId, 'pt')).rejects.toBeInstanceOf(
      VerificationRetryNotAllowedError,
    );
    expect(await userRow(user.userId)).toMatchObject({ isDeleted: true });
  });
});

describe('a refused or expired sending can be sent again', () => {
  it('a refusal allows attempt 2, which names the refused sending as retryOf', async () => {
    const fake = enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(row, 'face_mismatch')]);

    const again = await ageVerificationService.retry(user.userId, 'pt');

    expect(again.row).toMatchObject({
      attempt: 2,
      retryOf: row.providerReference,
      status: 'pending',
    });
    expect(again.status).toMatchObject({ status: 'pending' });
    expect(await userRow(user.userId)).toMatchObject({ verificationStatus: 'pending' });
    // The service is asked for the new sending with the reference of the refused one: another reviewer looks at it.
    expect(fake.requests.at(-1)).toMatchObject({
      verificationId: again.row.id,
      retryOf: row.providerReference,
    });
  });

  it('an expiry allows a new sending too', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([expiredEvent(row)]);

    expect(await ageVerificationService.statusFor(user.userId)).toMatchObject({
      status: 'expired',
      canRetry: true,
    });
    const again = await ageVerificationService.retry(user.userId, 'pt');
    expect(again.row).toMatchObject({ attempt: 2, retryOf: row.providerReference });
  });

  it('stops at the attempt limit: no retry past AGE_VERIFICATION_MAX_ATTEMPTS sendings', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    const max = env.AGE_VERIFICATION_MAX_ATTEMPTS;
    let open = row;

    for (let attempt = 1; attempt <= max; attempt++) {
      await postVerifierEvents([rejectedEvent(open, 'face_mismatch')]);
      const status = await ageVerificationService.statusFor(user.userId);
      expect(status.canRetry).toBe(attempt < max);
      if (attempt < max) {
        const next = await ageVerificationService.retry(user.userId, 'pt');
        expect(next.row.attempt).toBe(attempt + 1);
        open = next.row;
      }
    }

    await expect(ageVerificationService.retry(user.userId, 'pt')).rejects.toBeInstanceOf(
      VerificationRetryNotAllowedError,
    );
    expect(await sendingsOf(user.userId)).toHaveLength(max);
  });

  it('is not allowed for an approved account, which has nothing to retry', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);

    await expect(ageVerificationService.retry(user.userId, 'pt')).rejects.toBeInstanceOf(
      VerificationRetryNotAllowedError,
    );
  });

  it('is not allowed for an unknown account', async () => {
    enterRequiredMode();

    await expect(ageVerificationService.retry('no-such-user', 'pt')).rejects.toBeInstanceOf(
      AgeVerificationUserNotFoundError,
    );
  });
});

describe('starting a sending', () => {
  // Accounts are made before the server is in `required` mode: there registration itself makes the sending.
  it('refuses when no service is connected, and writes nothing', async () => {
    const ana = await registerUser('ana');
    enterRequiredMode();
    resetAgeVerifier();

    await expect(
      ageVerificationService.startVerification({
        userId: ana.userId,
        username: ana.username,
        language: 'pt',
      }),
    ).rejects.toBeInstanceOf(VerificationUnavailableError);
    expect(await sendingsOf(ana.userId)).toHaveLength(0);
    expect(await userRow(ana.userId)).toMatchObject({ verificationStatus: 'active' });
  });

  it('refuses when the service fails to start it, and writes nothing', async () => {
    const ana = await registerUser('ana');
    const fake = enterRequiredMode();
    fake.state.createFails = true;

    await expect(
      ageVerificationService.startVerification({
        userId: ana.userId,
        username: ana.username,
        language: 'pt',
      }),
    ).rejects.toBeInstanceOf(VerificationUnavailableError);
    expect(await sendingsOf(ana.userId)).toHaveLength(0);
  });

  it('asks the service for a sending with the verification id it will be recorded under', async () => {
    const ana = await registerUser('ana');
    const fake = enterRequiredMode();

    const started = await ageVerificationService.startVerification({
      userId: ana.userId,
      username: ana.username,
      language: 'pt',
    });

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      verificationId: started.row.id,
      subject: { userId: ana.userId, username: ana.username },
      language: 'pt',
    });
    expect(started.row).toMatchObject({
      status: 'pending',
      attempt: 1,
      retryOf: null,
      providerReference: `fake_ref_${started.row.id}`,
    });
  });

  it('lets registration ask first and record afterwards: the request writes nothing by itself', async () => {
    const ana = await registerUser('ana');
    enterRequiredMode();

    const sending = await ageVerificationService.requestFromVerifier({
      userId: ana.userId,
      username: ana.username,
      language: 'pt',
    });
    expect(await sendingsOf(ana.userId)).toHaveLength(0);

    const row = await ageVerificationService.recordPending(sending, 1);
    expect(row).toMatchObject({ id: sending.id, status: 'pending', userId: ana.userId });
  });
});

describe('the status of an account', () => {
  it('is not_required for an account that never sent a document', async () => {
    const ana = await registerUser('ana');

    expect(await ageVerificationService.statusFor(ana.userId)).toEqual({
      status: 'not_required',
    });
  });

  it('shows the action of a pending sending, so the app can show it again', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');

    expect(await ageVerificationService.statusFor(user.userId)).toEqual({
      status: 'pending',
      action: { kind: 'redirect', url: `https://verify.example.test/v/${row.id}` },
    });
  });

  it('says nothing secret about an approval', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);

    expect(await ageVerificationService.statusFor(user.userId)).toEqual({ status: 'approved' });
  });
});

describe('revoking an adults-only verification', () => {
  it('clears the adult flag and removes the account from the adults-only stories it was in', async () => {
    const ana = await registerUser('ana');
    enterRequiredMode();
    const bia = await pendingAccount('bia');
    await postVerifierEvents([approvedEvent(bia.row)]);
    // The approval leaves the old session pending; the fresh one is the account's from now on.
    bia.user.token = await activeSession(bia.user);
    await befriend(ana, bia.user);
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await db.update(stories).set({ isNsfw: true }).where(eq(stories.id, storyId));
    const invited = await request('POST', '/friend/story-invitations/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.user.userId, permissionType: 'reader' },
    });
    expect(invited.status).toBe(200);
    await request('PUT', `/friend/story-invitations/${invited.data.id}/accept`, {
      token: bia.user.token,
    });
    expect(await livePermission(bia.user.userId, storyId)).toBeDefined();

    await ageVerificationService.revoke(bia.user.userId, ana.userId);

    expect((await userRow(bia.user.userId))?.isAdultVerified).toBe(false);
    expect(await livePermission(bia.user.userId, storyId)).toBeUndefined();
  });

  it('records the revocation in the activity record', async () => {
    enterRequiredMode();
    const ana = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(ana.row)]);

    await ageVerificationService.revoke(ana.user.userId, null);
    await drainBackground(2000);

    const lines = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'account.verification_revoked'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ subjectUserId: ana.user.userId, category: 'account' });
  });

  it('refuses an unknown account', async () => {
    await expect(ageVerificationService.revoke('no-such-user', null)).rejects.toBeInstanceOf(
      AgeVerificationUserNotFoundError,
    );
  });
});

async function livePermission(userId: string, storyId: string) {
  return db.query.storyPermissions.findFirst({
    where: (table, { and, eq: equals }) =>
      and(
        equals(table.storyId, storyId),
        equals(table.userId, userId),
        equals(table.isDeleted, false),
      ),
  });
}

describe('the ledger of events', () => {
  it('keeps one line per fact the service reported, with what became of it', async () => {
    enterRequiredMode();
    const ana = await pendingAccount('ana');
    const event = approvedEvent(ana.row);

    await postVerifierEvents([event]);

    const lines = await db
      .select()
      .from(ageVerificationEvents)
      .where(eq(ageVerificationEvents.eventId, event.eventId as string));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ verifierId: 'fakeverify', outcome: 'applied' });
  });
});
