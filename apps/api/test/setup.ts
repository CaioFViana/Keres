// Minimal configuration for importing the application without depending on the operator's .env file.
//
// The `??=` matters: setting the variable BEFORE any module loads keeps `src/db`'s and
// `src/config/env`'s `dotenv.config()` from overwriting it (dotenv never replaces an existing key).
// That is what guarantees a suite never touches the development database.
//
// The default points at `docker-compose.test.yml`'s disposable Postgres, so `bun run test:integration`
// works locally with nothing to configure. With `DATABASE_DRIVER=sqlite` the suite runs over a
// temporary file and needs no database up at all - see `test:integration:sqlite`.
if (process.env.DATABASE_DRIVER === 'sqlite') {
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  // `??=` is not enough here, unlike everywhere else in this file: the SQLite suite runs in the same
  // CI job as the Postgres one, which exports a `postgres://` URL for the whole job. Defaulting would
  // leave that URL in place and libsql refuses it outright (URL_SCHEME_NOT_SUPPORTED). An inherited
  // URL this client cannot open is replaced; a deliberate `file:`/`libsql:` one is respected.
  const libsqlUrl = /^(file|libsql|wss?|https?):/.test(process.env.DATABASE_URL ?? '');
  if (!libsqlUrl) {
    process.env.DATABASE_URL = `file:${join(tmpdir(), 'keres-test.db')}`;
  }
} else {
  // The port is the same as `docker-compose.test.yml`'s, and comes from the same place:
  // `KERES_TEST_DB_PORT`. The 45432 default exists because the 55389-55488 range is reserved by Windows
  // on machines with Hyper-V/WSL, and Docker cannot publish on it.
  const port = process.env.KERES_TEST_DB_PORT ?? '45432';
  process.env.DATABASE_URL ??= `postgres://keres_test:keres_test@localhost:${port}/keres_test`;
}
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-at-least-thirty-two-characters';
process.env.JWT_SECRET_REFRESH ??= 'test-refresh-secret-that-is-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';

// Media written to disk goes to a disposable folder, never to the operator's `./media-storage`
// (`env.ts`'s default, relative to the directory the process started from).
import * as os from 'node:os';
import * as path from 'node:path';
process.env.MEDIA_STORAGE_PATH ??= path.join(os.tmpdir(), 'keres-media-test');
