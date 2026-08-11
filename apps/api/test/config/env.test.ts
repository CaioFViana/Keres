import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O alvo aqui é o schema de validação, não o carregamento de arquivo. Sem neutralizar o
 * dotenv, um `apps/api/.env` presente na máquina do operador preenche justamente as variáveis
 * que os testes de "faltando" precisam remover, e a suíte passa ou falha conforme a máquina.
 */
vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

/**
 * `src/config/env.ts` valida no import: qualquer mudança precisa de um módulo novo. Todas as
 * variáveis relevantes são stubadas explicitamente.
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgres://test:test@localhost:5432/keres_test',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-thirty-two-characters',
  JWT_SECRET_REFRESH: 'test-refresh-secret-that-is-at-least-thirty-two-characters',
  PORT: '',
  SERVER_VERSION: '',
  MEDIA_STORAGE_DRIVER: '',
  MEDIA_STORAGE_PATH: '',
  MEDIA_S3_ENDPOINT: '',
  MEDIA_S3_REGION: '',
  MEDIA_S3_BUCKET: '',
  MEDIA_S3_ACCESS_KEY_ID: '',
  MEDIA_S3_SECRET_ACCESS_KEY: '',
  MEDIA_S3_PREFIX: '',
  MEDIA_S3_FORCE_PATH_STYLE: '',
  MEDIA_MAX_BYTES: '',
  ROOT_ADMIN_USERNAME: '',
  ROOT_ADMIN_PASSWORD: '',
  DEFAULT_PASSWORD_RESET_VALUE: '',
};

/** Campos com `.default()` puro: string vazia é inválida, então precisam ser removidos. */
const DEFAULTED_KEYS = [
  'PORT',
  'SERVER_VERSION',
  'MEDIA_STORAGE_DRIVER',
  'MEDIA_STORAGE_PATH',
  'MEDIA_S3_REGION',
  'MEDIA_S3_PREFIX',
  'MEDIA_S3_FORCE_PATH_STYLE',
  'MEDIA_MAX_BYTES',
  'ROOT_ADMIN_USERNAME',
  'ROOT_ADMIN_PASSWORD',
  'DEFAULT_PASSWORD_RESET_VALUE',
];

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();

  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value === undefined || (value === '' && DEFAULTED_KEYS.includes(key))) {
      vi.stubEnv(key, undefined as unknown as string);
    } else {
      vi.stubEnv(key, value);
    }
  }

  return (await import('../../src/config/env')).env;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env', () => {
  it('applies the local-first defaults when only the required secrets are set', async () => {
    const env = await loadEnv();

    expect(env).toMatchObject({
      PORT: '3000',
      SERVER_VERSION: '1.0.0',
      MEDIA_STORAGE_DRIVER: 'local',
      MEDIA_STORAGE_PATH: './media-storage',
      MEDIA_S3_REGION: 'us-east-1',
      MEDIA_S3_PREFIX: 'keres',
      MEDIA_S3_FORCE_PATH_STYLE: false,
      MEDIA_MAX_BYTES: 50 * 1024 * 1024,
      DEFAULT_PASSWORD_RESET_VALUE: 'abc123',
    });
  });

  it('rejects a DATABASE_URL that is not a URL', async () => {
    await expect(loadEnv({ DATABASE_URL: 'not a url' })).rejects.toThrow();
  });

  // `z.url()` só exige que `new URL()` aceite o valor, então um host:porta solto passa aqui e
  // só falha na primeira conexão. Documentado como comportamento atual, não como desejado.
  it('does not catch a host:port string missing its scheme', async () => {
    expect((await loadEnv({ DATABASE_URL: 'localhost:5432' })).DATABASE_URL).toBe('localhost:5432');
  });

  it.each(['JWT_SECRET', 'JWT_SECRET_REFRESH'])('rejects a %s shorter than 32 characters', async (key) => {
    await expect(loadEnv({ [key]: 'too-short' })).rejects.toThrow();
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'JWT_SECRET_REFRESH'])('requires %s to be present', async (key) => {
    await expect(loadEnv({ [key]: undefined })).rejects.toThrow();
  });

  it('turns empty S3 fields into "not configured" instead of invalid values', async () => {
    const env = await loadEnv();

    expect(env.MEDIA_S3_BUCKET).toBeUndefined();
    expect(env.MEDIA_S3_ENDPOINT).toBeUndefined();
    expect(env.MEDIA_S3_ACCESS_KEY_ID).toBeUndefined();
  });

  it.each(['MEDIA_S3_BUCKET', 'MEDIA_S3_ACCESS_KEY_ID', 'MEDIA_S3_SECRET_ACCESS_KEY'])(
    'refuses to boot with MEDIA_STORAGE_DRIVER=s3 and no %s',
    async (missing) => {
      const s3Env = {
        MEDIA_STORAGE_DRIVER: 's3',
        MEDIA_S3_BUCKET: 'keres-media',
        MEDIA_S3_ACCESS_KEY_ID: 'access-key',
        MEDIA_S3_SECRET_ACCESS_KEY: 'secret-key',
        [missing]: '',
      };

      await expect(loadEnv(s3Env)).rejects.toThrow(missing);
    },
  );

  it('accepts a fully configured s3 driver', async () => {
    const env = await loadEnv({
      MEDIA_STORAGE_DRIVER: 's3',
      MEDIA_S3_BUCKET: 'keres-media',
      MEDIA_S3_ACCESS_KEY_ID: 'access-key',
      MEDIA_S3_SECRET_ACCESS_KEY: 'secret-key',
      MEDIA_S3_ENDPOINT: 'http://127.0.0.1:8333',
      MEDIA_S3_FORCE_PATH_STYLE: 'true',
    });

    expect(env.MEDIA_STORAGE_DRIVER).toBe('s3');
    expect(env.MEDIA_S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.MEDIA_S3_ENDPOINT).toBe('http://127.0.0.1:8333');
  });

  it('rejects a storage driver that has no implementation', async () => {
    await expect(loadEnv({ MEDIA_STORAGE_DRIVER: 'gcs' })).rejects.toThrow();
  });

  it('coerces MEDIA_MAX_BYTES from its string form and rejects nonsense', async () => {
    expect((await loadEnv({ MEDIA_MAX_BYTES: '1048576' })).MEDIA_MAX_BYTES).toBe(1048576);
    await expect(loadEnv({ MEDIA_MAX_BYTES: '0' })).rejects.toThrow();
    await expect(loadEnv({ MEDIA_MAX_BYTES: 'not-a-number' })).rejects.toThrow();
  });

  it('rejects a root admin password below the minimum, so boot fails loudly', async () => {
    await expect(loadEnv({ ROOT_ADMIN_USERNAME: 'root', ROOT_ADMIN_PASSWORD: 'short' })).rejects.toThrow();
  });

  it('skips root admin reconciliation entirely when the credentials are absent', async () => {
    const env = await loadEnv();

    expect(env.ROOT_ADMIN_USERNAME).toBeUndefined();
    expect(env.ROOT_ADMIN_PASSWORD).toBeUndefined();
  });
});
