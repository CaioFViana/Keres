import { beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_POLICY_VERSION, privacyPolicyDigest } from '@/legal/privacyPolicy';
import { SERVER_TERMS_VERSION, serverTermsDigest } from '@/legal/serverTerms';
import { truncateAll } from '@test/helpers/database';
import { registerUser, request } from '@test/helpers/app';

beforeEach(async () => {
  await truncateAll();
});

describe('legal document digests', () => {
  it('names the exact text as a stable 64-hex SHA-256', () => {
    for (const digest of [serverTermsDigest(), privacyPolicyDigest()]) {
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(serverTermsDigest()).toBe(serverTermsDigest());
    expect(privacyPolicyDigest()).toBe(privacyPolicyDigest());
  });
});

describe('POST /auth/register', () => {
  it('records acceptance of the current terms and privacy policy', async () => {
    const ana = await registerUser('ana');

    const { status, data } = await request('GET', '/auth/terms-status', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toEqual({
      tos: { accepted: SERVER_TERMS_VERSION, current: SERVER_TERMS_VERSION },
      privacy: { accepted: PRIVACY_POLICY_VERSION, current: PRIVACY_POLICY_VERSION },
    });
  });
});

describe('GET /auth/terms-status', () => {
  it('requires a session', async () => {
    const { status } = await request('GET', '/auth/terms-status');

    expect(status).toBe(401);
  });
});

describe('POST /auth/terms-accept', () => {
  it('re-accepts idempotently: twice without a version bump changes nothing', async () => {
    const ana = await registerUser('ana');

    for (const kind of ['tos', 'privacy'] as const) {
      const { status, data } = await request('POST', '/auth/terms-accept', {
        token: ana.token,
        body: { kind },
      });
      expect(status).toBe(200);
      expect(data[kind].accepted).toBe(data[kind].current);
    }

    const { data: again } = await request('POST', '/auth/terms-accept', {
      token: ana.token,
      body: { kind: 'tos' },
    });
    expect(again.tos).toEqual({
      accepted: SERVER_TERMS_VERSION,
      current: SERVER_TERMS_VERSION,
    });
  });

  it('requires a session', async () => {
    const { status } = await request('POST', '/auth/terms-accept', {
      body: { kind: 'tos' },
    });

    expect(status).toBe(401);
  });

  it('refuses an unknown document kind', async () => {
    const ana = await registerUser('ana');

    const { status } = await request('POST', '/auth/terms-accept', {
      token: ana.token,
      body: { kind: 'cookies' },
    });

    expect(status).toBe(422);
  });
});
