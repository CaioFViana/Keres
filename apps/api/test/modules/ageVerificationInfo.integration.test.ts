import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';
import {
  resetAgeVerifier,
  setAgeVerifier,
} from '../../src/services/ageVerification/AgeVerifierRegistry';
import { request } from '../helpers/app';
import { createFakeAgeVerifier } from '../helpers/fakeAgeVerifier';
import { enterRequiredMode, leaveRequiredMode } from '../helpers/ageVerificationAccounts';
import { truncateAll } from '../helpers/database';

beforeEach(async () => {
  await truncateAll();
});

afterEach(() => {
  leaveRequiredMode();
});

describe('GET /api/age-verification/info', () => {
  it('says manual and unavailable on a server that has no verification service (the default)', async () => {
    const { status, data } = await request('GET', '/age-verification/info');

    expect(status).toBe(200);
    expect(data).toEqual({ mode: 'manual', available: false });
  });

  it('is public: it answers without a session', async () => {
    const { status } = await request('GET', '/age-verification/info');

    expect(status).toBe(200);
  });

  it('says manual and unavailable even with a service connected: manual never calls one', async () => {
    setAgeVerifier(createFakeAgeVerifier().verifier);
    env.AGE_VERIFICATION_MODE = 'manual';

    const { data } = await request('GET', '/age-verification/info');

    expect(data).toEqual({ mode: 'manual', available: false });
  });

  it('says required and unavailable when the server should verify but no service answers', async () => {
    env.AGE_VERIFICATION_MODE = 'required';
    resetAgeVerifier();

    const { data } = await request('GET', '/age-verification/info');

    expect(data).toEqual({ mode: 'required', available: false });
  });

  it('says required and available when the server verifies and the service is connected', async () => {
    enterRequiredMode();

    const { data } = await request('GET', '/age-verification/info');

    expect(data).toEqual({ mode: 'required', available: true });
  });
});
