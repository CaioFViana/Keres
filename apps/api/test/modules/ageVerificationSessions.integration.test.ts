import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { ageVerifications, users } from '@/db/schema';
import { ageVerificationService } from '@/services/age-verification/AgeVerificationService';
import { resetAgeVerifier } from '@/services/age-verification/AgeVerifierRegistry';
import { registerUser, request, uploadTestStory } from '@test/helpers/app';
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

/**
 * Registration in `required` mode and the session that goes with a pending account (`docs/compliance/age_verification.md`,
 * "Registration in required mode"). Accounts that exist before the mode is entered are active; the ones made after it
 * are pending until the fake service decides.
 */

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
  vi.restoreAllMocks();
});

const PASSWORD = 'senha-de-teste-123';

/** The claims of a token (its middle segment). Read only: the server did the signing. */
function claimsOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));
}

const register = (username: string, headers?: Record<string, string>) =>
  request('POST', '/auth/register', { body: { username, password: PASSWORD }, headers });

const usersNamed = (username: string) =>
  db.select().from(users).where(eq(users.username, username));

const sendingsOf = (userId: string) =>
  db.select().from(ageVerifications).where(eq(ageVerifications.userId, userId));

/** The sending still open for an account (the one a retry or an approval is about). */
async function openSendingOf(userId: string) {
  const rows = await db.query.ageVerifications.findMany({
    where: eq(ageVerifications.userId, userId),
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
  });
  return rows.find((row) => row.status === 'pending');
}

describe('registration in required mode', () => {
  it('creates a pending account with its sending, and answers with what the person does next', async () => {
    const fake = enterRequiredMode();

    const { status, data } = await register('ana', { 'accept-language': 'pt-BR,pt;q=0.9' });

    expect(status).toBe(200);
    expect(data.verification).toMatchObject({
      status: 'pending',
      action: {
        kind: 'redirect',
        url: `https://verify.example.test/v/${fake.requests[0]!.verificationId}`,
      },
    });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      subject: { userId: data.userId, username: 'ana' },
      language: 'pt',
    });
    expect(await userRow(data.userId)).toMatchObject({
      verificationStatus: 'pending',
      isAdultVerified: false,
    });
    const [sending] = await sendingsOf(data.userId);
    expect(sending).toMatchObject({
      id: fake.requests[0]!.verificationId,
      status: 'pending',
      attempt: 1,
      retryOf: null,
    });
  });

  it('gives the pending account a pending session, which reaches nothing but the verification routes', async () => {
    enterRequiredMode();
    const { data } = await register('ana');
    const token = data.accessToken as string;

    expect(claimsOf(token)).toMatchObject({ pending: true, userId: data.userId });
    expect(claimsOf(data.refreshToken)).toMatchObject({ pending: true });

    const refused = await request('GET', '/user/plan', { token });
    expect(refused.status).toBe(403);
    expect(refused.data).toEqual({
      message: 'Verify your age to use this account.',
      code: 'verification_pending',
    });
    expect((await request('POST', '/auth/ws-ticket', { token })).status).toBe(403);

    expect((await request('GET', '/auth/verification', { token })).data).toMatchObject({
      status: 'pending',
      action: { kind: 'redirect' },
    });
    expect((await request('GET', '/auth/terms-status', { token })).status).toBe(200);
    expect((await request('GET', '/keres-tos')).status).toBe(200);
  });

  it('keeps a pending account out of every other person sight: tag, profile, friend request, invitation', async () => {
    const ana = await registerUser('ana'); // made before the mode: active
    enterRequiredMode();
    const bia = await register('bia');
    const biaId = bia.data.userId as string;
    const story = await uploadTestStory(ana.token, 'Noite');

    expect((await request('GET', '/user/by-tag/bia', { token: ana.token })).status).toBe(404);
    expect((await request('GET', `/user/details/${biaId}`, { token: ana.token })).status).toBe(404);
    expect((await request('POST', `/friend/request/${biaId}`, { token: ana.token })).status).toBe(
      404,
    );
    expect(
      (
        await request('POST', '/friend/story-invitations/', {
          token: ana.token,
          body: { storyId: story.id, targetUserId: biaId, permissionType: 'reader' },
        })
      ).status,
    ).toBe(404);
    // Its own pending session does not reach the profile either: only the verification routes answer it.
    expect(
      (await request('GET', `/user/details/${biaId}`, { token: bia.data.accessToken })).status,
    ).toBe(403);
  });

  it('refuses when no service is connected, before any account is created', async () => {
    enterRequiredMode();
    resetAgeVerifier();

    const { status, data } = await register('ana');

    expect(status).toBe(503);
    expect(data).toEqual({
      message: 'Account creation is unavailable on this server right now.',
      code: 'verification_unavailable',
    });
    expect(await usersNamed('ana')).toHaveLength(0);
  });

  it('refuses when the service fails to start the verification, and creates nothing', async () => {
    const fake = enterRequiredMode();
    fake.state.createFails = true;

    const { status, data } = await register('ana');

    expect(status).toBe(503);
    expect(data.code).toBe('verification_unavailable');
    expect(await usersNamed('ana')).toHaveLength(0);
    expect(await db.select().from(ageVerifications)).toHaveLength(0);
  });

  it('takes the account back and asks the service to drop the sending when the sending cannot be recorded', async () => {
    const fake = enterRequiredMode({ withCancel: true });
    vi.spyOn(ageVerificationService, 'recordPending').mockRejectedValueOnce(
      new Error('the database is full'),
    );

    const { status } = await register('ana');

    expect(status).toBe(500);
    expect(await usersNamed('ana')).toHaveLength(0);
    expect(fake.cancelVerification).toHaveBeenCalledWith(
      `fake_ref_${fake.requests[0]!.verificationId}`,
    );
  });

  it('answers the same as before when verification is disabled: active, no verification, no claim', async () => {
    const { status, data } = await register('ana');

    expect(status).toBe(200);
    expect(data).not.toHaveProperty('verification');
    expect(claimsOf(data.accessToken)).not.toHaveProperty('pending');
    expect(await userRow(data.userId)).toMatchObject({ verificationStatus: 'active' });
    expect(await sendingsOf(data.userId)).toHaveLength(0);
    expect((await request('GET', '/user/plan', { token: data.accessToken })).status).toBe(200);
  });
});

describe('a pending account signs in again', () => {
  it('signs in with a pending session, and refresh and recovery keep the claim while it is pending', async () => {
    enterRequiredMode();
    const { data } = await register('ana');

    const login = await request('POST', '/auth/login', {
      body: { username: 'ana', password: PASSWORD },
    });
    expect(login.status).toBe(200);
    expect(claimsOf(login.data.accessToken)).toMatchObject({ pending: true });

    const refreshed = await request('POST', '/auth/refresh', {
      body: { refreshToken: data.refreshToken },
    });
    expect(refreshed.status).toBe(200);
    expect(claimsOf(refreshed.data.accessToken)).toMatchObject({ pending: true });
    expect(claimsOf(refreshed.data.refreshToken)).toMatchObject({ pending: true });

    const recovered = await request('POST', '/auth/forgot-password', {
      body: { username: 'ana', recoveryCode: data.recoveryCodes[0], newPassword: 'senha-nova-456' },
    });
    expect(recovered.status).toBe(200);
    expect(claimsOf(recovered.data.accessToken)).toMatchObject({ pending: true });
  });
});

describe('the verification routes', () => {
  it('approval makes the account active, and the next answer gives a fresh session, once', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);

    const first = await request('GET', '/auth/verification', { token: user.token });

    expect(first.status).toBe(200);
    expect(first.data).toMatchObject({ status: 'approved' });
    expect(first.data.session).toBeDefined();
    const fresh = first.data.session.accessToken as string;
    expect(claimsOf(fresh)).not.toHaveProperty('pending');
    expect(claimsOf(first.data.session.refreshToken)).not.toHaveProperty('pending');
    expect(await userRow(user.userId)).toMatchObject({
      verificationStatus: 'active',
      isAdultVerified: true,
    });

    // The new session works everywhere; the pending one still does not.
    expect((await request('GET', '/user/plan', { token: fresh })).status).toBe(200);
    expect((await request('GET', '/user/plan', { token: user.token })).status).toBe(403);
    // Once the app carries the new session, the answer comes without another one.
    expect(
      (await request('GET', '/auth/verification', { token: fresh })).data.session,
    ).toBeUndefined();
  });

  it('a refresh after approval turns the refresh token of a pending session into a full session', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);

    const refreshed = await request('POST', '/auth/refresh', {
      body: { refreshToken: user.refreshToken },
    });

    expect(refreshed.status).toBe(200);
    expect(claimsOf(refreshed.data.accessToken)).not.toHaveProperty('pending');
  });

  it('a refusal can be sent again: the retry names the refused sending, and an approval of the new one activates', async () => {
    const fake = enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(row, 'face_mismatch')]);

    const rejected = await request('GET', '/auth/verification', { token: user.token });
    expect(rejected.data).toMatchObject({
      status: 'rejected',
      reason: 'face_mismatch',
      canRetry: true,
    });

    const retry = await request('POST', '/auth/verification/retry', {
      token: user.token,
      headers: { 'accept-language': 'pt' },
    });
    expect(retry.status).toBe(200);
    expect(retry.data).toMatchObject({ status: 'pending', action: { kind: 'redirect' } });
    expect(fake.requests.at(-1)).toMatchObject({ retryOf: row.providerReference, language: 'pt' });

    const next = (await openSendingOf(user.userId))!;
    expect(next).toMatchObject({ attempt: 2, retryOf: row.providerReference });
    await postVerifierEvents([approvedEvent(next)]);

    const approved = await request('GET', '/auth/verification', { token: user.token });
    expect(approved.data.session).toBeDefined();
  });

  it('an expiry reads as expired at once when its time has run out, and may be sent again', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await db
      .update(ageVerifications)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(ageVerifications.id, row.id));

    const lapsed = await request('GET', '/auth/verification', { token: user.token });
    expect(lapsed.data).toMatchObject({ status: 'expired', canRetry: true });

    const retry = await request('POST', '/auth/verification/retry', { token: user.token });
    expect(retry.status).toBe(200);
    expect(await sendingsOf(user.userId)).toHaveLength(2);
    expect(
      (await db.query.ageVerifications.findFirst({ where: eq(ageVerifications.id, row.id) }))!
        .status,
    ).toBe('expired');
    // The late expiry event for the old sending changes nothing: the account is still on its new one.
    await postVerifierEvents([expiredEvent(row)]);
    expect(await userRow(user.userId)).toMatchObject({ verificationStatus: 'pending' });
  });

  it('an underage refusal closes the account: sign-in fails, and there is no second try', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(row, 'underage')]);

    const answer = await request('GET', '/auth/verification', { token: user.token });
    expect(answer.data).toEqual({ status: 'rejected', reason: 'underage', canRetry: false });

    expect(
      (await request('POST', '/auth/login', { body: { username: 'ana', password: PASSWORD } }))
        .status,
    ).toBe(401);
    expect((await request('POST', '/auth/verification/retry', { token: user.token })).status).toBe(
      409,
    );
    expect(await userRow(user.userId)).toMatchObject({ isDeleted: true });
  });

  it('refuses a retry for an account that is already active, and a retry to an unknown account', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);
    const fresh = (await request('GET', '/auth/verification', { token: user.token })).data.session
      .accessToken as string;

    const { status, data } = await request('POST', '/auth/verification/retry', { token: fresh });

    expect(status).toBe(409);
    expect(data.message).toBe('This account cannot send a new document for verification.');
  });

  it('limits the retries of an account: the sixth in the hour is refused, whatever the answer of the others', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([approvedEvent(row)]);
    const fresh = (await request('GET', '/auth/verification', { token: user.token })).data.session
      .accessToken as string;

    // Each of the first five is answered by the service's rules (here: 409, an approved account has nothing to send).
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await request('POST', '/auth/verification/retry', { token: fresh })).status).toBe(
        409,
      );
    }
    expect((await request('POST', '/auth/verification/retry', { token: fresh })).status).toBe(429);
  });

  it('answers 503 when a retry finds no service to send through', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('ana');
    await postVerifierEvents([rejectedEvent(row, 'face_mismatch')]);
    resetAgeVerifier();

    const { status, data } = await request('POST', '/auth/verification/retry', {
      token: user.token,
    });

    expect(status).toBe(503);
    expect(data.code).toBe('verification_unavailable');
    expect((await userRow(user.userId))?.verificationStatus).toBe('rejected');
  });
});
