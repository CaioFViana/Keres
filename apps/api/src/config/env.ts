import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Independent of the directory `bun run` was called from; the API's `.env` lives in apps/api.
const environmentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(environmentDirectory, '..', '..', '.env') });

// Docker Compose expands unset variables as an empty string. For the optional S3 fields, empty has
// to mean "not configured", not an invalid endpoint/secret in local mode.
const optionalEnvironmentString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  /**
   * Qual motor de banco usar. `postgres` exige um servidor; `sqlite` guarda tudo num arquivo
   * local (Keres Server caseiro, sem Docker).
   */
  DATABASE_DRIVER: z.enum(['postgres', 'sqlite']).optional().default('postgres'),
  /**
   * With `postgres`, the connection URL. With `sqlite`, the file - `file:./keres.db` or an absolute
   * path.
   *
   * The validation depends on the engine: `z.url()` alone would accept "localhost:5432" (reading
   * "localhost:" as the protocol) and the error would only surface as a connection failure at boot.
   */
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_SECRET_REFRESH: z.string().min(32, 'JWT_SECRET_REFRESH must be at least 32 characters long'),
  PORT: z.string().optional().default('3000'),
  /**
   * Interface HTTP. Ausente deixa o Bun escutar em todas (Compose / `bun run api:start`).
   * O launcher caseiro preenche `127.0.0.1` ou `0.0.0.0`.
   */
  HOST: optionalEnvironmentString,
  NODE_ENV: z.string().optional().default('development'),
  /** The gallery's physical backend. Do not change it on a database that already holds media without migrating it. */
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).optional().default('local'),
  /** Root where the gallery's media files are written (addressed by hash). */
  MEDIA_STORAGE_PATH: z.string().optional().default('./media-storage'),
  /** Optional endpoint for S3-compatible providers; absent, it uses AWS's endpoint. */
  MEDIA_S3_ENDPOINT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
  MEDIA_S3_REGION: z.string().min(1).optional().default('us-east-1'),
  MEDIA_S3_BUCKET: optionalEnvironmentString,
  MEDIA_S3_ACCESS_KEY_ID: optionalEnvironmentString,
  MEDIA_S3_SECRET_ACCESS_KEY: optionalEnvironmentString,
  MEDIA_S3_PREFIX: z.string().optional().default('keres'),
  MEDIA_S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
  /** Per-file ceiling. A phone video easily goes past 20 MB, hence the 50 MB default. */
  MEDIA_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(50 * 1024 * 1024),
  /**
   * Credentials for the "root" admin, reconciled in the database at every boot (see
   * `reconcileRootAdmin` in `index.ts`). It solves the "what if nobody is an admin" problem: instead
   * of a bootstrap script that runs once, this account is recreated/corrected (isAdmin always forced
   * to true, the password always re-hashed from the env's current value) every time the API comes up.
   * Both are optional - if they are not set, the reconciliation is simply skipped.
   */
  ROOT_ADMIN_USERNAME: z.string().min(1).optional(),
  ROOT_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export const env = envSchema.parse(process.env);

if (env.DATABASE_DRIVER === 'postgres' && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
  throw new Error(
    'DATABASE_URL must start with postgres:// or postgresql:// when DATABASE_DRIVER=postgres.',
  );
}

if (env.DATABASE_DRIVER === 'sqlite' && !/^(file:|\/|[A-Za-z]:)/.test(env.DATABASE_URL)) {
  throw new Error(
    'DATABASE_URL must be a file path (file:./keres.db, or an absolute path) when DATABASE_DRIVER=sqlite.',
  );
}

if (env.MEDIA_STORAGE_DRIVER === 's3') {
  const missing = [
    ['MEDIA_S3_BUCKET', env.MEDIA_S3_BUCKET],
    ['MEDIA_S3_ACCESS_KEY_ID', env.MEDIA_S3_ACCESS_KEY_ID],
    ['MEDIA_S3_SECRET_ACCESS_KEY', env.MEDIA_S3_SECRET_ACCESS_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`MEDIA_STORAGE_DRIVER=s3 requires: ${missing.join(', ')}.`);
  }
}
