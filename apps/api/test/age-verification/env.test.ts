import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The target here is the validation schema, not file loading: the same neutralising of dotenv as `test/config/env.test.ts`,
 * so an operator's `apps/api/.env` cannot decide what these tests prove.
 */
vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const SERVICE_SECRET = 's'.repeat(40);
const EVENTS_SECRET = 'e'.repeat(40);
const URL_HTTPS = 'https://verify.example.test/age';

const AGE_KEYS = [
  'AGE_VERIFICATION_MODE',
  'AGE_VERIFICATION_URL',
  'AGE_VERIFICATION_SECRET',
  'AGE_VERIFICATION_SECRET_PREVIOUS',
  'AGE_VERIFICATION_EVENTS_SECRET',
  'AGE_VERIFICATION_EVENTS_SECRET_PREVIOUS',
  'AGE_VERIFICATION_TIMEOUT_MS',
  'AGE_VERIFICATION_ALLOW_INSECURE',
  'AGE_VERIFICATION_PENDING_DAYS',
  'AGE_VERIFICATION_MAX_ATTEMPTS',
];

/** Every age-verification key is removed unless a test sets it: what the developer's shell or the suite setup says does not count. */
const BASE_ENV: Record<string, string | undefined> = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/keres_test',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-thirty-two-characters',
  JWT_SECRET_REFRESH: 'test-refresh-secret-that-is-at-least-thirty-two-characters',
  ...Object.fromEntries(AGE_KEYS.map((key) => [key, undefined])),
};

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();

  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(key, value as string);
  }

  return (await import('@/config/env')).env;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The settings a `required` server needs to start. */
const REQUIRED = {
  AGE_VERIFICATION_MODE: 'required',
  AGE_VERIFICATION_URL: URL_HTTPS,
  AGE_VERIFICATION_SECRET: SERVICE_SECRET,
  AGE_VERIFICATION_EVENTS_SECRET: EVENTS_SECRET,
};

describe('age verification settings', () => {
  it('is manual when nothing is set, and an empty value (as Compose gives) counts as unset', async () => {
    const unset = await loadEnv();
    const empty = await loadEnv({ AGE_VERIFICATION_MODE: '', AGE_VERIFICATION_URL: '' });

    expect(unset).toMatchObject({
      AGE_VERIFICATION_MODE: 'manual',
      AGE_VERIFICATION_ALLOW_INSECURE: false,
      AGE_VERIFICATION_PENDING_DAYS: 30,
      AGE_VERIFICATION_MAX_ATTEMPTS: 3,
      AGE_VERIFICATION_TIMEOUT_MS: 10_000,
    });
    expect(unset.AGE_VERIFICATION_URL).toBeUndefined();
    expect(empty.AGE_VERIFICATION_MODE).toBe('manual');
    expect(empty.AGE_VERIFICATION_URL).toBeUndefined();
  });

  it('starts in manual mode with no service at all', async () => {
    const env = await loadEnv({ AGE_VERIFICATION_MODE: 'manual' });

    expect(env.AGE_VERIFICATION_MODE).toBe('manual');
    expect(env.AGE_VERIFICATION_SECRET).toBeUndefined();
  });

  it('reads the legacy value disabled as manual, so an existing .env keeps booting', async () => {
    const env = await loadEnv({ AGE_VERIFICATION_MODE: 'disabled' });

    expect(env.AGE_VERIFICATION_MODE).toBe('manual');
    expect(env.AGE_VERIFICATION_SECRET).toBeUndefined();
  });

  it('accepts required mode when the address and both keys are given', async () => {
    const env = await loadEnv(REQUIRED);

    expect(env.AGE_VERIFICATION_MODE).toBe('required');
    expect(env.AGE_VERIFICATION_URL).toBe(URL_HTTPS);
  });

  it('refuses a mode that does not exist', async () => {
    await expect(loadEnv({ AGE_VERIFICATION_MODE: 'optional' })).rejects.toThrow(
      'AGE_VERIFICATION_MODE',
    );
  });

  it('refuses required mode without the service address, so boot does not start', async () => {
    await expect(loadEnv({ ...REQUIRED, AGE_VERIFICATION_URL: undefined })).rejects.toThrow(
      'is required when AGE_VERIFICATION_MODE=required',
    );
  });

  it.each(['AGE_VERIFICATION_SECRET', 'AGE_VERIFICATION_EVENTS_SECRET'])(
    'refuses required mode without %s',
    async (missing) => {
      await expect(loadEnv({ ...REQUIRED, [missing]: undefined })).rejects.toThrow(missing);
    },
  );

  it('refuses a key shorter than 32 characters', async () => {
    await expect(loadEnv({ ...REQUIRED, AGE_VERIFICATION_SECRET: 'too-short' })).rejects.toThrow(
      'at least 32 characters',
    );
  });

  it('refuses an events key equal to the service key: one key per direction', async () => {
    await expect(
      loadEnv({ ...REQUIRED, AGE_VERIFICATION_EVENTS_SECRET: SERVICE_SECRET }),
    ).rejects.toThrow('must differ from AGE_VERIFICATION_SECRET');
  });

  it('refuses a service address with no keys even when the mode is manual, as the payment connector does', async () => {
    await expect(loadEnv({ AGE_VERIFICATION_URL: URL_HTTPS })).rejects.toThrow(
      'is required with AGE_VERIFICATION_URL',
    );
  });

  it.each([
    ['an https address', 'https://verify.example.test/age', false, true],
    ['a plain http address to this machine', 'http://localhost:8080/age', false, true],
    ['a plain http address to another machine', 'http://verify.example.test/age', false, false],
    [
      'a plain http address to another machine, when allowed',
      'http://verify.example.test/age',
      true,
      true,
    ],
  ])('takes %s', async (_label, url, allowInsecure, accepted) => {
    const attempt = loadEnv({
      ...REQUIRED,
      AGE_VERIFICATION_URL: url,
      AGE_VERIFICATION_ALLOW_INSECURE: allowInsecure ? 'true' : undefined,
    });

    if (accepted) {
      expect((await attempt).AGE_VERIFICATION_URL).toBe(url);
    } else {
      await expect(attempt).rejects.toThrow('must be https');
    }
  });

  it('accepts the two day and attempt limits inside their bounds, and refuses them outside', async () => {
    expect(
      (await loadEnv({ AGE_VERIFICATION_PENDING_DAYS: '1' })).AGE_VERIFICATION_PENDING_DAYS,
    ).toBe(1);
    expect(
      (await loadEnv({ AGE_VERIFICATION_MAX_ATTEMPTS: '10' })).AGE_VERIFICATION_MAX_ATTEMPTS,
    ).toBe(10);

    await expect(loadEnv({ AGE_VERIFICATION_PENDING_DAYS: '0' })).rejects.toThrow();
    await expect(loadEnv({ AGE_VERIFICATION_PENDING_DAYS: '366' })).rejects.toThrow();
    await expect(loadEnv({ AGE_VERIFICATION_MAX_ATTEMPTS: '0' })).rejects.toThrow();
    await expect(loadEnv({ AGE_VERIFICATION_MAX_ATTEMPTS: '11' })).rejects.toThrow();
  });
});
