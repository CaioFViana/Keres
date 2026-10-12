import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgeVerificationPrune } from '../../src/boot';
import { env } from '../../src/config/env';
import { db } from '../../src/db';
import {
  ageVerifications,
  auditEvents,
  REGISTRATION_SETTINGS_SINGLETON_ID,
  registrationSettings,
  stories,
  termsAcceptances,
  users,
} from '../../src/db/schema';
import { privacyPolicyDigest, privacyPolicyFor } from '../../src/legal/privacyPolicy';
import { serverTermsDigest, serverTermsFor } from '../../src/legal/serverTerms';
import { ageVerificationService } from '../../src/services/ageVerification/AgeVerificationService';
import { storyNsfwService } from '../../src/services/StoryNsfwService';
import { registrationSettingsService } from '../../src/services/RegistrationSettingsService';
import { drainBackground } from '../../src/utils/backgroundWork';
import {
  importTestStory,
  registerUser,
  request,
  type TestUser,
  uploadTestStory,
} from '../helpers/app';
import {
  enterRequiredMode,
  leaveRequiredMode,
  pendingAccount,
  userRow,
} from '../helpers/ageVerificationAccounts';
import { promoteToAdmin, truncateAll } from '../helpers/database';

/**
 * Where verification is off, nobody is verified and there is no adults-only area, whatever the stored values say; and
 * an administrator cannot verify anybody by hand (`docs/age_verification.md`, "Modes").
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_VERIFICATION_MESSAGE =
  'This server has no age verification, so it has no adults-only area.';

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

describe('an administrator cannot verify an account by hand', () => {
  it('refuses to set the flag where verification is disabled, and leaves the account as it was', async () => {
    const ana = await registerUser('ana');

    const { status, data } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(400);
    expect(data.message).toBe(
      'Accounts are verified by the age-verification service, not by hand.',
    );
    expect(await userRow(ana.userId)).toMatchObject({ isAdultVerified: false });
  });

  it('refuses the same where verification is required', async () => {
    const ana = await registerUser('ana');
    enterRequiredMode();

    const { status, data } = await adminPut(ana.userId, { isAdultVerified: true });

    expect(status).toBe(400);
    expect(data.message).toBe(
      'Accounts are verified by the age-verification service, not by hand.',
    );
    expect(await userRow(ana.userId)).toMatchObject({ isAdultVerified: false });
  });

  it('revokes through the service: the flag goes, the account leaves the adults-only stories, and it is recorded', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    enterRequiredMode();
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, bia.userId));
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

describe('where verification is disabled, a stored "verified" reads as unverified', () => {
  it('does not show the flag to the account or to another person, and refuses the adults-only story', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, bia.userId));
    await befriend(ana, bia);
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await db.update(stories).set({ isNsfw: true }).where(eq(stories.id, storyId));

    expect((await request('GET', '/auth/me', { token: bia.token })).data.isAdultVerified).toBe(
      false,
    );
    expect(
      (await request('GET', `/user/details/${bia.userId}`, { token: ana.token })).data
        .isAdultVerified,
    ).toBe(false);
    expect(
      (await request('GET', `/user/by-tag/bia`, { token: ana.token })).data.isAdultVerified,
    ).toBe(false);

    const invited = await request('POST', '/friend/story-invitations/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    expect(invited.status).toBe(403);
    expect(invited.data.message).toBe('Only age-verified (+18) users can join NSFW stories.');
  });

  it('refuses a sync that flags a story adults-only where verification is disabled', async () => {
    // Found in a real run: the app flagged a story +18 and the server applied it. The refusal has to hold on the sync
    // path itself (the path the app uses), not only in the service.
    const ana = await registerUser('ana');
    const storyId = (await uploadTestStory(ana.token, 'Noite')).id;
    await registrationSettingsService.getOrCreate();
    await db
      .update(registrationSettings)
      .set({ allowNsfw: true })
      .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID));
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
    expect(pushed.data.conflicts.map((conflict: { reason: string }) => conflict.reason)).toEqual([
      'unauthorized',
    ]);
    expect((await db.query.stories.findFirst({ where: eq(stories.id, storyId) }))!.isNsfw).toBe(
      false,
    );
  });

  it('refuses to import a story package that arrives flagged adults-only where verification is disabled', async () => {
    // Found in a real run: "send to server" imports the whole story, and the flag went in with it.
    const ana = await registerUser('ana');
    await registrationSettingsService.getOrCreate();
    await db
      .update(registrationSettings)
      .set({ allowNsfw: true })
      .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID));
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));

    const flagged = await importTestStory(ana.token, 'Noite', 'linear', { isNsfw: true });
    const refusal = flagged.data as { message?: string; code?: string };
    expect(flagged.status).toBe(403);
    expect(refusal.message).toBe(NO_VERIFICATION_MESSAGE);
    // Not a plan ceiling, so no tier_limit code: the app must not show a plan hint for it.
    expect(refusal.code).toBeUndefined();
    expect(await db.query.stories.findMany()).toEqual([]);

    // The same story without the flag is an ordinary upload.
    const plain = await importTestStory(ana.token, 'Noite');
    expect(plain.status).toBe(200);
  });

  it('refuses the flag on a story, whatever the stored allowance says', async () => {
    const ana = await registerUser('ana');
    await registrationSettingsService.getOrCreate();
    await db
      .update(registrationSettings)
      .set({ allowNsfw: true })
      .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_SINGLETON_ID));
    await db.update(users).set({ isAdultVerified: true }).where(eq(users.id, ana.userId));

    expect(await storyNsfwService.isAdultVerified(ana.userId)).toBe(false);
    expect(await storyNsfwService.nsfwFlagRefusal(ana.userId)).toBe(NO_VERIFICATION_MESSAGE);
  });
});

describe('the adults-only area exists only where verification is required', () => {
  it('refuses to switch the allowance on where verification is disabled, and stores nothing', async () => {
    const { status, data } = await request('PUT', '/admin/registration-settings', {
      token: admin.token,
      body: { allowNsfw: true },
    });

    expect(status).toBe(400);
    expect(data.message).toBe(NO_VERIFICATION_MESSAGE);
    expect((await registrationSettingsService.getOrCreate()).allowNsfw).toBe(false);
  });

  it('allows switching it off where verification is disabled', async () => {
    const { status } = await request('PUT', '/admin/registration-settings', {
      token: admin.token,
      body: { allowNsfw: false },
    });

    expect(status).toBe(200);
  });

  it('allows the switch where verification is required', async () => {
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
    const disabledTerms = serverTermsFor('disabled');
    const requiredTerms = serverTermsFor('required');
    expect(disabledTerms.en).not.toEqual(requiredTerms.en);

    const disabledTos = await request('GET', '/keres-tos');
    expect(disabledTos.data.en).toEqual(disabledTerms.en);
    expect(disabledTos.data.pt).toEqual(disabledTerms.pt);
    const disabledPrivacy = await request('GET', '/keres-privacy');
    expect(disabledPrivacy.data.en).toEqual(privacyPolicyFor('disabled').en);

    enterRequiredMode();

    const requiredTos = await request('GET', '/keres-tos');
    expect(requiredTos.data.en).toEqual(requiredTerms.en);
    expect(requiredTos.data.pt).toEqual(requiredTerms.pt);
    const requiredPrivacy = await request('GET', '/keres-privacy');
    expect(requiredPrivacy.data.en).toEqual(privacyPolicyFor('required').en);
  });

  it('records each acceptance against the digest of the text this server shows', async () => {
    const disabledUser = await registerUser('ana');
    enterRequiredMode();
    const requiredUser = await pendingAccount('bia');

    const rowsOf = (userId: string) =>
      db.select().from(termsAcceptances).where(eq(termsAcceptances.userId, userId));
    const digestsOf = async (userId: string) => {
      const rows = await rowsOf(userId);
      return Object.fromEntries(rows.map((row) => [row.kind, row.textHash]));
    };

    expect(await digestsOf(disabledUser.userId)).toEqual({
      tos: serverTermsDigest('disabled'),
      privacy: privacyPolicyDigest('disabled'),
    });
    expect(await digestsOf(requiredUser.user.userId)).toEqual({
      tos: serverTermsDigest('required'),
      privacy: privacyPolicyDigest('required'),
    });
    expect(serverTermsDigest('disabled')).not.toBe(serverTermsDigest('required'));
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
