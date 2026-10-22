import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The Keres API on a throwaway SQLite database, serving the hosted client at `/client` - the setup of a person's
 * home server, which is what a browser talks to when it signs in. A fresh database on every start: the tests
 * register accounts, and registration is rate limited per address.
 *
 *   E2E_API_PORT=3399 bun api-server.ts
 *
 * The hosted client is `apps/client/dist-hosted` (`bun run --cwd apps/client build:hosted`); the API finds it by
 * itself. The port is not 3000, which is where a developer's own API usually runs.
 */
const PORT = process.env.E2E_API_PORT ?? '3399';
const apiRoot = resolve(import.meta.dirname, '..', 'api');
const workDirectory = mkdtempSync(join(tmpdir(), 'keres-e2e-api-'));

const server: ChildProcess = spawn('bun', ['run', 'src/server.ts'], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_DRIVER: 'sqlite',
    DATABASE_URL: `file:${join(workDirectory, 'keres.db').replaceAll('\\', '/')}`,
    MEDIA_STORAGE_PATH: join(workDirectory, 'media'),
    JWT_SECRET: 'e2e-jwt-secret-that-is-at-least-thirty-two-chars',
    JWT_SECRET_REFRESH: 'e2e-refresh-secret-that-is-at-least-thirty-two',
    HOST: '127.0.0.1',
    PORT,
  },
});

function stop(code: number) {
  server.kill();
  rmSync(workDirectory, { recursive: true, force: true });
  process.exit(code);
}

server.on('exit', (code) => stop(code ?? 1));
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
