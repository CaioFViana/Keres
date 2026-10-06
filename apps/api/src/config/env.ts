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

/** A key shared with the payment connector: long enough to be a key and not a word (see `MIN_SECRET_LENGTH`). */
const connectorSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(32, 'must have at least 32 characters').optional(),
);

const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1';

const envSchema = z.object({
  /**
   * Which database engine to use. `postgres` needs a server; `sqlite` keeps everything in a local
   * file (home-hosted Keres Server, no Docker).
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
   * HTTP interface. When absent, Bun listens on all of them (Compose / `bun run api:start`).
   * The home-hosted launcher fills in `127.0.0.1` or `0.0.0.0`.
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
  /**
   * Pulls plus pushes one user may make per minute. A device syncs a few times a minute at most;
   * the ceiling only stops a runaway client. Raised for load and convergence tests.
   */
  SYNC_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().optional().default(120),
  ROOT_ADMIN_PASSWORD: z.string().min(8).optional(),
  /** How many days the admin's activity record keeps its lines; older ones are dropped once a day. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).optional().default(365),
  /**
   * How long a stopping server lets the requests already running finish before closing them, in
   * milliseconds. `docker stop` waits 10 s by default before killing, so the default leaves room for the
   * rest of the shutdown; raise both together (`stop_grace_period`).
   */
  /**
   * The payment connector this server sells plans through: the address of a separate service that speaks to one
   * payment provider (see docs/payment_connectors.md). Absent, the server sells nothing and nothing about payments
   * is shown. It must be `https`, unless it is this machine (`localhost`) or `PAYMENT_CONNECTOR_ALLOW_INSECURE` says
   * the network between them can be trusted with what is not secret: every message is signed whatever the transport,
   * but only TLS keeps them private.
   */
  PAYMENT_CONNECTOR_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
  /** Signs what Keres sends the connector, and is what Keres checks the connector's answers with. At least 32 characters. */
  PAYMENT_CONNECTOR_SECRET: connectorSecret,
  /** The key that was in use before, still accepted for the connector's answers while a key is being replaced. */
  PAYMENT_CONNECTOR_SECRET_PREVIOUS: connectorSecret,
  /** What Keres checks the connector's events with: another key than the one above, on purpose. At least 32 characters. */
  PAYMENT_EVENTS_SECRET: connectorSecret,
  /** The key that was in use before, still accepted for events while a key is being replaced. */
  PAYMENT_EVENTS_SECRET_PREVIOUS: connectorSecret,
  /** How long a call to the connector may take before it is given up on, in milliseconds. */
  PAYMENT_CONNECTOR_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60_000)
    .optional()
    .default(10_000),
  /**
   * The Bearer [REDACTED] the payments service asks for at `POST /v1/play/verify`. Only the server holds it: the app
   * proves its purchase to Keres, and Keres proves itself to the service. Absent, store purchases cannot be
   * relayed (the `playbilling` method should not be listed then either). At least 32 characters.
   */
  PAYMENT_PLAY_ENDPOINT_SECRET: connectorSecret,
  /** Allows a connector at an address that is not `https` and not this machine (a private network between containers). */
  PAYMENT_CONNECTOR_ALLOW_INSECURE: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Lets a payment page open at a plain `http` address. For development only, with a connector on this machine: a
   * redirect to `http` can be read and altered on the way, which is why it is refused by default.
   */
  PAYMENT_ALLOW_INSECURE_REDIRECTS: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * How long after an account was closed its payment records are kept in a form that points at the person, in days.
   * After it the subscription, the attempts and the store claims of that account are deleted and the ledger keeps
   * its lines (amounts, plans, dates) without the person or the provider's reference. Unset: kept as they are.
   * At least 30, so a late refund or a dispute can still be tied to the account.
   */
  PAYMENT_RETENTION_DAYS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(30).max(3650).optional(),
  ),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().min(0).optional().default(7000),
});

export const env = envSchema
  .superRefine((value, context) => {
    const url = value.PAYMENT_CONNECTOR_URL;
    if (!url) return;
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (!value.PAYMENT_CONNECTOR_SECRET) {
      issue('PAYMENT_CONNECTOR_SECRET', 'is required with PAYMENT_CONNECTOR_URL');
    }
    if (!value.PAYMENT_EVENTS_SECRET) {
      issue('PAYMENT_EVENTS_SECRET', 'is required with PAYMENT_CONNECTOR_URL');
    }
    if (
      value.PAYMENT_CONNECTOR_SECRET &&
      value.PAYMENT_CONNECTOR_SECRET === value.PAYMENT_EVENTS_SECRET
    ) {
      issue(
        'PAYMENT_EVENTS_SECRET',
        'must differ from PAYMENT_CONNECTOR_SECRET: one key per direction',
      );
    }
    const { protocol, hostname } = new URL(url);
    if (
      protocol !== 'https:' &&
      !isLoopbackHost(hostname) &&
      !value.PAYMENT_CONNECTOR_ALLOW_INSECURE
    ) {
      issue(
        'PAYMENT_CONNECTOR_URL',
        'must be https (or this machine); set PAYMENT_CONNECTOR_ALLOW_INSECURE=true only for a network you trust',
      );
    }
  })
  .parse(process.env);

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
