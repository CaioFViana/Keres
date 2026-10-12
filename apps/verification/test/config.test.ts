import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_MAX_UPLOAD_BYTES,
  isSameOrInside,
  loadConfig,
  samePath,
} from '../src/config';
import { EVENTS_SECRET, COMMITMENT_KEY, KERES_SECRET, testEnv } from './helpers/harness';

const DATA = resolve('/srv/verification/data');
const KEYS = resolve('/srv/verification/keys');

function problemsOf(env: NodeJS.ProcessEnv): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return [...error.problems];
    throw error;
  }
  return [];
}

const valid = (overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => {
  const env = { ...testEnv(DATA, KEYS), ...overrides } as NodeJS.ProcessEnv;
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[name];
  }
  return env;
};

describe('verification config', () => {
  it('loads with the defaults of the reference service', () => {
    const config = loadConfig(valid());
    expect(config.port).toBe(3102);
    expect(config.host).toBe('127.0.0.1');
    expect(config.serviceId).toBe('keres-manual');
    expect(config.displayName).toBe('Keres manual verification');
    expect(config.submissionTtlDays).toBe(30);
    expect(config.maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(config.maxUploadBytes).toBe(8 * 1024 * 1024);
    expect(config.keresSecrets).toEqual([KERES_SECRET]);
    expect(config.publicUrl).toBe('https://verify.test');
    expect(config.allowInsecure).toBe(false);
  });

  it('lists every problem at once, not only the first', () => {
    const problems = problemsOf({});
    expect(problems).toEqual(
      expect.arrayContaining([
        'AGE_VERIFICATION_SECRET is required.',
        'AGE_VERIFICATION_EVENTS_SECRET is required.',
        'COMMITMENT_KEY is required.',
        'PUBLIC_URL is required.',
        'KERES_EVENTS_URL is required.',
      ]),
    );
    expect(problems.length).toBeGreaterThanOrEqual(5);
  });

  it('refuses secrets shorter than 32 characters, and names the variable', () => {
    expect(problemsOf(valid({ AGE_VERIFICATION_SECRET: 'short' }))).toContain(
      'AGE_VERIFICATION_SECRET must be at least 32 characters.',
    );
    expect(problemsOf(valid({ COMMITMENT_KEY: 'short' }))).toContain(
      'COMMITMENT_KEY must be at least 32 characters.',
    );
    expect(problemsOf(valid({ AGE_VERIFICATION_SECRET_PREVIOUS: 'short' }))).toContain(
      'AGE_VERIFICATION_SECRET_PREVIOUS must be at least 32 characters.',
    );
  });

  it('refuses equal keys: the events key and the commitment key must differ from the Keres key', () => {
    expect(problemsOf(valid({ AGE_VERIFICATION_EVENTS_SECRET: KERES_SECRET }))).toContain(
      'AGE_VERIFICATION_SECRET and AGE_VERIFICATION_EVENTS_SECRET must differ.',
    );
    expect(problemsOf(valid({ COMMITMENT_KEY: EVENTS_SECRET }))).toContain(
      'AGE_VERIFICATION_EVENTS_SECRET and COMMITMENT_KEY must differ.',
    );
    expect(problemsOf(valid({ COMMITMENT_KEY: KERES_SECRET }))).toContain(
      'AGE_VERIFICATION_SECRET and COMMITMENT_KEY must differ.',
    );
  });

  it('keeps the previous key in the accepted list, and refuses it when it equals another key', () => {
    const config = loadConfig(
      valid({ AGE_VERIFICATION_SECRET_PREVIOUS: 'test-previous-keres-secret-0123456789' }),
    );
    expect(config.keresSecrets).toHaveLength(2);
    expect(config.keresSecrets[0]).toBe(KERES_SECRET);
    expect(problemsOf(valid({ AGE_VERIFICATION_SECRET_PREVIOUS: EVENTS_SECRET }))).toContain(
      'AGE_VERIFICATION_SECRET_PREVIOUS and AGE_VERIFICATION_EVENTS_SECRET must differ.',
    );
  });

  it('refuses KEY_DIR inside DATA_DIR: a backup of the data would carry the keys', () => {
    const problems = problemsOf(valid({ KEY_DIR: join(DATA, 'keys') }));
    expect(problems.join('\n')).toMatch(/KEY_DIR must not be inside DATA_DIR/);
  });

  it('refuses the same directory for DATA_DIR and KEY_DIR', () => {
    expect(problemsOf(valid({ KEY_DIR: DATA }))).toContain(
      'DATA_DIR and KEY_DIR must be different directories.',
    );
  });

  it('accepts two sibling directories, and a KEY_DIR that only shares a name prefix with DATA_DIR', () => {
    expect(() => loadConfig(valid({ KEY_DIR: `${DATA}-keys` }))).not.toThrow();
    expect(() => loadConfig(valid({ KEY_DIR: KEYS }))).not.toThrow();
  });

  it('refuses a public address that is plain http outside loopback, unless ALLOW_INSECURE is set', () => {
    expect(problemsOf(valid({ PUBLIC_URL: 'http://verify.test' }))).toContain(
      'PUBLIC_URL must be https (loopback is allowed; ALLOW_INSECURE=true allows plain http elsewhere).',
    );
    expect(problemsOf(valid({ KERES_EVENTS_URL: 'http://keres.example/events' }))).toContain(
      'KERES_EVENTS_URL must be https (loopback is allowed; ALLOW_INSECURE=true allows plain http elsewhere).',
    );
    expect(() =>
      loadConfig(valid({ PUBLIC_URL: 'http://verify.test', ALLOW_INSECURE: 'true' })),
    ).not.toThrow();
  });

  it('accepts plain http on loopback without ALLOW_INSECURE', () => {
    expect(() =>
      loadConfig(
        valid({
          PUBLIC_URL: 'http://127.0.0.1:3102',
          KERES_EVENTS_URL: 'http://localhost:3000/api/age-verification/events',
        }),
      ),
    ).not.toThrow();
  });

  it('refuses values that are not URLs or not whole numbers in range', () => {
    expect(problemsOf(valid({ PUBLIC_URL: 'verify.test' }))).toContain('PUBLIC_URL is not a URL.');
    expect(problemsOf(valid({ PUBLIC_URL: 'ftp://verify.test' }))).toContain(
      'PUBLIC_URL must be an http or https address.',
    );
    expect(problemsOf(valid({ SUBMISSION_TTL_DAYS: '0' }))).toContain(
      'SUBMISSION_TTL_DAYS must be a whole number from 1 to 365.',
    );
    expect(problemsOf(valid({ SUBMISSION_TTL_DAYS: '30days' }))).toContain(
      'SUBMISSION_TTL_DAYS must be a whole number from 1 to 365.',
    );
    expect(problemsOf(valid({ MAX_UPLOAD_BYTES: '0' }))).toContain(
      'MAX_UPLOAD_BYTES must be a whole number from 1 to 67108864.',
    );
    expect(problemsOf(valid({ PORT: '70000' }))).toContain(
      'PORT must be a whole number from 1 to 65535.',
    );
  });

  it('refuses a service id outside the protocol pattern', () => {
    expect(problemsOf(valid({ SERVICE_ID: 'Keres Manual' }))).toContain(
      'SERVICE_ID must be 1-32 lower-case letters, digits, "-" or "_".',
    );
    expect(loadConfig(valid({ SERVICE_ID: 'keres_manual-2' })).serviceId).toBe('keres_manual-2');
  });

  it('reports the keys by name only: no secret value appears in a problem', () => {
    const problems = problemsOf(
      valid({ AGE_VERIFICATION_SECRET: 'short-but-secret-looking' }),
    ).join('\n');
    expect(problems).not.toContain('short-but-secret-looking');
    expect(problems).not.toContain(COMMITMENT_KEY);
  });
});

describe('directory containment', () => {
  it('tells a directory inside another from a sibling and from the same one', () => {
    expect(isSameOrInside(join(DATA, 'keys'), DATA)).toBe(true);
    expect(isSameOrInside(DATA, DATA)).toBe(true);
    expect(isSameOrInside(`${DATA}-keys`, DATA)).toBe(false);
    expect(isSameOrInside(KEYS, DATA)).toBe(false);
    expect(samePath(DATA, `${DATA}${'/'}`)).toBe(true);
  });
});
