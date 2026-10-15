import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgeVerificationPrune } from '@/boot';
import { env } from '@/config/env';
import { db } from '@/db';
import {
  ageVerifications,
  auditEvents,
  REGISTRATION_SETTINGS_SINGLETON_ID,
  registrationSettings,
  stories,
  termsAcceptances,
  users,
} from '@/db/schema';
import { privacyPolicyDigest, privacyPolicyFor } from '@/legal/privacyPolicy';
import { serverTermsDigest, serverTermsFor } from '@/legal/serverTerms';
import { ageVerificationService } from '@/services/age-verification/AgeVerificationService';
import { storyNsfwService } from '@/services/stories/StoryNsfwService';
import { registrationSettingsService } from '@/services/admin/RegistrationSettingsService';
import { drainBackground } from '@/utils/backgroundWork';
import {
  importTestStory,
  registerUser,
  request,
  type TestUser,
  uploadTestStory,
} from '@test/helpers/app';
import {
  enterRequiredMode,
  leaveRequiredMode,
  pendingAccount,
  userRow,
} from '@test/helpers/ageVerificationAccounts';
import { promoteToAdmin, truncateAll } from '@test/helpers/database';

/**
 * How the two modes differ once an account exists (`docs/age_verification.md`, "Modes"): in `manual` an administrator
 * marks and revokes the verified flag by hand and the adults-only area can be on; in `required` the external service
 * is the only one that verifies, so granting by hand is refused (revoking still goes through the service).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

let admin: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
});

afterEach(() => {
  leaveRequiredMode();
  vi.restoreAllMocks();
});

const adminPut = (userId: string, body: Record<string, unknown>) =>
  request('PUT', `/admin/api/users/${userId}`, { token: admin.token, body });

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

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

async function allowAdultsOnly() {
  await registrationSettingsService.getOrCreate();
  await db
    .update(registrationSettings)
    .set({ allowNsfw: true })
    .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID));
}

describe('in manual mode an administrator verifies and revokes by hand', () => {
  it('marks the account verified: the flag, the time, the method "manual", the account active, and an audit line', async () => {
    const ana = await registerUser('ana');

    const { status, data } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(200);
    expect(data.isAdultVerified).toBe(true);
    const row = await userRow(ana.userId);
    expect(row).toMatchObject({
      isAdultVerified: true,
      verificationMethod: 'manual',
      verificationStatus: 'active',
    });
    expect(row?.verifiedAt).toBeInstanceOf(Date);
    const lines = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'account.verification_granted'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ subjectUserId: ana.userId, actorUserId: admin.userId });
  });

  it('keeps an account that is already verified verified when the grant is repeated', async () => {
    const ana = await registerUser('ana');
    await adminPut(ana.userId, { isAdultVerified: true });

    const firstGrant = (await userRow(ana.userId))?.verifiedAt;

    const { status } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(200);
    expect(await userRow(ana.userId)).toMatchObject({
      isAdultVerified: true,
      verificationMethod: 'manual',
    });
    // Nothing changed, so there is no new date and no second audit line.
    expect((await userRow(ana.userId))?.verifiedAt).toEqual(firstGrant);
    const lines = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'account.verification_granted'));
    expect(lines).toHaveLength(1);
  });

  it('refuses to verify a deleted account', async () => {
    const ana = await registerUser('ana');
    await db.update(users).set({ isDeleted: true }).where(eq(users.id, ana.userId));

    const { status, data } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(409);
    expect(data.message).toBe('This account is deleted, so it cannot be verified.');
    expect(await userRow(ana.userId)).toMatchObject({ isAdultVerified: false });
  });

  it('refuses the grant in required mode, and leaves the account as it was', async () => {
    const ana = await registerUser('ana');
    enterRequiredMode();

    const { status, data } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(400);
    expect(data.message).toBe(
      'Accounts are verified by the age-verification service, not by hand.',
    );
    expect(await userRow(ana.userId)).toMatchObject({ isAdultVerified: false });
    const lines = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'account.verification_granted'));
    expect(lines).toHaveLength(0);
  });

  it('revokes: the flag goes, the account leaves the adults-only stories, and it is recorded', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    await adminPut(bia.userId, { isAdultVerified: true });
    await befriend(ana, bia);
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await db.update(stories).set({ isNsfw: true }).where(eq(stories.id, storyId));
    const invited = await request('POST', '/friend/story-invitations/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    expect(invited.status).toBe(200);
    await request('PUT', `/friend/story-invitations/${invited.data.id}/accept`, {
      token: bia.token,
    });
    expect(await livePermission(bia.userId, storyId)).toBeDefined();
    const revoke = vi.spyOn(ageVerificationService, 'revoke');

    const { status } = await adminPut(bia.userId, { isAdultVerified: false });
    await drainBackground(2000);

    expect(status).toBe(200);
    expect(revoke).toHaveBeenCalledWith(bia.userId, admin.userId);
    expect(await userRow(bia.userId)).toMatchObject({ isAdultVerified: false });
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();
    const lines = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'account.verification_revoked'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ subjectUserId: bia.userId, actorUserId: admin.userId });
  });
});

describe('in manual mode a new account is active at once and not verified', () => {
  it('registers an account that can use the server, with no verification pending', async () => {
    const ana = await registerUser('ana');

    expect(await userRow(ana.userId)).toMatchObject({
      isAdultVerified: false,
      verificationStatus: 'active',
    });
    const plan = await request('GET', '/user/plan', { token: ana.token });
    expect(plan.status).toBe(200);
  });
});

describe('in manual mode a stored verified flag counts', () => {
  it('shows the flag to the account and to another person, and admits them to an adults-only story', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, bia.userId));
    await befriend(ana, bia);
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await db.update(stories).set({ isNsfw: true }).where(eq(stories.id, storyId));

    expect((await request('GET', '/auth/me', { token: bia.token })).data.isAdultVerified).toBe(
      true,
    );
    expect(
      (await request('GET', `/user/details/${bia.userId}`, { token: ana.token })).data
        .isAdultVerified,
    ).toBe(true);
    expect(
      (await request('GET', `/user/by-tag/bia`, { token: ana.token })).data.isAdultVerified,
    ).toBe(true);

    const invited = await request('POST', '/friend/story-invitations/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    expect(invited.status).toBe(200);
  });

  it('accepts a sync that flags a story adults-only once the allowance is on and the owner is verified', async () => {
    const ana = await registerUser('ana');
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await allowAdultsOnly();
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });

    const pushed = await request('POST', `/sync/${storyId}`, {
      token: ana.token,
      body: [
        {
          type: 'update',
          entity: 'Story',
          id: storyId,
          changes: { isNsfw: true, version: story!.version },
          clientOperationId: 'local-flag-1',
        },
      ],
    });

    expect(pushed.status).toBe(200);
    expect(pushed.data.conflicts).toEqual([]);
    expect((await db.query.stories.findFirst({ where: eq(stories.id, storyId) }))!.isNsfw).toBe(
      true,
    );
  });

  it('refuses a sync that flags a story adults-only when the owner is not verified', async () => {
    const ana = await registerUser('ana');
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await allowAdultsOnly();
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });

    const pushed = await request('POST', `/sync/${storyId}`, {
      token: ana.token,
      body: [
        {
          type: 'update',
          entity: 'Story',
          id: storyId,
          changes: { isNsfw: true, version: story!.version },
          clientOperationId: 'local-flag-2',
        },
      ],
    });

    expect(pushed.status).toBe(200);
    expect(pushed.data.conflicts.map((conflict: { reason: string }) => conflict.reason)).toEqual([
      'unauthorized',
    ]);
    expect((await db.query.stories.findFirst({ where: eq(stories.id, storyId) }))!.isNsfw).toBe(
      false,
    );
  });

  it('imports a story flagged adults-only once the allowance is on and the owner is verified', async () => {
    const ana = await registerUser('ana');
    await allowAdultsOnly();
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));

    const flagged = await importTestStory(ana.token, 'Noite', 'linear', { isNsfw: true });

    expect(flagged.status).toBe(200);
    expect(
      (await db.query.stories.findFirst({ where: eq(stories.id, flagged.data.storyId) }))!.isNsfw,
    ).toBe(true);
  });

  it('refuses the flag on a story when the allowance is off, whatever the verification says', async () => {
    const ana = await registerUser('ana');
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));

    expect(await storyNsfwService.isAdultVerified(ana.userId)).toBe(true);
    expect(await storyNsfwService.nsfwFlagRefusal(ana.userId)).toBe(
      'This server does not allow adults-only (+18) content.',
    );
  });

  it('refuses the flag on a story from an account that is not verified, and allows it once verified', async () => {
    const ana = await registerUser('ana');
    await allowAdultsOnly();

    expect(await storyNsfwService.nsfwFlagRefusal(ana.userId)).toBe(
      'Only age-verified (+18) users can flag stories adults-only.',
    );
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));
    expect(await storyNsfwService.nsfwFlagRefusal(ana.userId)).toBeNull();
  });
});

describe('in manual mode the adults-only area can be switched on', () => {
  it('switches the allowance on, and it is stored', async () => {
    const { status } = await request('PUT', '/admin/registration-settings', {
      token: admin.token,
      body: { allowNsfw: true },
    });

    expect(status).toBe(200);
    expect((await registrationSettingsService.getOrCreate()).allowNsfw).toBe(true);
  });

  it('switches it off again', async () => {
    await allowAdultsOnly();

    const { status } = await request('PUT', '/admin/registration-settings', {
      token: admin.token,
      body: { allowNsfw: false },
    });

    expect(status).toBe(200);
    expect((await registrationSettingsService.getOrCreate()).allowNsfw).toBe(false);
  });

  it('allows the switch in required mode too', async () => {
    enterRequiredMode();

    const { status } = await request('PUT', '/admin/registration-settings', {
      token: admin.token,
      body: { allowNsfw: true },
    });

    expect(status).toBe(200);
    expect((await registrationSettingsService.getOrCreate()).allowNsfw).toBe(true);
  });
});

describe('the terms and the policy say what this server is', () => {
  it('serves the text of the mode the server runs in, from /keres-tos and /keres-privacy', async () => {
    const manualTerms = serverTermsFor('manual');
    const requiredTerms = serverTermsFor('required');
    expect(manualTerms.en).not.toEqual(requiredTerms.en);

    const manualTos = await request('GET', '/keres-tos');
    expect(manualTos.data.en).toEqual(manualTerms.en);
    expect(manualTos.data.pt).toEqual(manualTerms.pt);
    const manualPrivacy = await request('GET', '/keres-privacy');
    expect(manualPrivacy.data.en).toEqual(privacyPolicyFor('manual').en);

    enterRequiredMode();

    const requiredTos = await request('GET', '/keres-tos');
    expect(requiredTos.data.en).toEqual(requiredTerms.en);
    expect(requiredTos.data.pt).toEqual(requiredTerms.pt);
    const requiredPrivacy = await request('GET', '/keres-privacy');
    expect(requiredPrivacy.data.en).toEqual(privacyPolicyFor('required').en);
  });

  it('records each acceptance against the digest of the text this server shows', async () => {
    const manualUser = await registerUser('ana');
    enterRequiredMode();
    const requiredUser = await pendingAccount('bia');

    const rowsOf = (userId: string) =>
      db.select().from(termsAcceptances).where(eq(termsAcceptances.userId, userId));
    const digestsOf = async (userId: string) => {
      const rows = await rowsOf(userId);
      return Object.fromEntries(rows.map((row) => [row.kind, row.textHash]));
    };

    expect(await digestsOf(manualUser.userId)).toEqual({
      tos: serverTermsDigest('manual'),
      privacy: privacyPolicyDigest('manual'),
    });
    expect(await digestsOf(requiredUser.user.userId)).toEqual({
      tos: serverTermsDigest('required'),
      privacy: privacyPolicyDigest('required'),
    });
    expect(serverTermsDigest('manual')).not.toBe(serverTermsDigest('required'));
  });
});

describe('the cleanup of abandoned accounts, as the scheduler runs it', () => {
  it('deletes an account abandoned past the window and reports what it did, without waiting for the clock', async () => {
    enterRequiredMode();
    const { user, row } = await pendingAccount('stale');
    const old = new Date(Date.now() - (env.AGE_VERIFICATION_PENDING_DAYS + 1) * DAY_MS);
    await db
      .update(ageVerifications)
      .set({ createdAt: old })
      .where(eq(ageVerifications.id, row.id));
    await db.update(users).set({ createdAt: old }).where(eq(users.id, user.userId));

    const outcome = await runAgeVerificationPrune();

    expect(outcome).toEqual({ accountsDeleted: 1, accountsRefused: 0, sendingsDeleted: 0 });
    expect(await userRow(user.userId)).toBeUndefined();
  });

  it('keeps an account still inside its window', async () => {
    enterRequiredMode();
    const { user } = await pendingAccount('recent');

    const outcome = await runAgeVerificationPrune();

    expect(outcome?.accountsDeleted).toBe(0);
    expect(await userRow(user.userId)).toBeDefined();
  });

  it('logs a failure and returns null instead of throwing into the timer', async () => {
    vi.spyOn(ageVerificationService, 'pruneAbandoned').mockRejectedValueOnce(
      new Error('the database is down'),
    );

    await expect(runAgeVerificationPrune()).resolves.toBeNull();
  });
});
