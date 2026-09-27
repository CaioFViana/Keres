import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { repoRoot } from './lib/packages';

/**
 * Runs the client's convergence fuzz against the real API instead of its in-memory reference model.
 *
 *   bun scripts/sync-fuzz-api.ts
 *   SYNC_FUZZ_SEEDS=200 SYNC_FUZZ_STEPS=60 bun scripts/sync-fuzz-api.ts
 *
 * Starts `apps/api/test/syncFuzz/server.ts` (the application plus a few test-only controls) on the
 * disposable test database - `docker compose -f apps/api/docker-compose.test.yml up -d` first -
 * then runs `SyncConvergenceFuzz.test.ts` pointed at it, with one Jest worker: every seed resets
 * the one shared database. The `SYNC_FUZZ_*` variables pass through (seeds, steps, first seed,
 * trace). The rate limit is lifted for the run: three devices of one user syncing as fast as a
 * test can far exceed what a person produces.
 */

const port = process.env.KERES_TEST_DB_PORT ?? '45432';
const serverEnv = {
  ...process.env,
  // 127.0.0.1, not localhost: Bun resolves localhost to ::1 first, where Docker may not listen.
  DATABASE_URL:
    process.env.DATABASE_URL ?? `postgres://keres_test:keres_test@127.0.0.1:${port}/keres_test`,
  SYNC_REQUESTS_PER_MINUTE: '1000000',
  SYNC_FUZZ_PORT: process.env.SYNC_FUZZ_PORT ?? '0',
};

function startServer(): Promise<{ server: ChildProcess; origin: string }> {
  return new Promise((resolve, reject) => {
    const server = spawn('bun', ['test/syncFuzz/server.ts'], {
      cwd: join(repoRoot, 'apps/api'),
      env: serverEnv,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let buffered = '';
    server.stdout?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const ready = /SYNC_FUZZ_READY (\S+)/.exec(buffered);
      if (ready) resolve({ server, origin: ready[1]! });
    });
    server.on('exit', (code) => reject(new Error(`The fuzz server exited early (${code}).`)));
  });
}

const { server, origin } = await startServer();
console.log(`Real API up at ${origin}.`);
const code = await new Promise<number>((resolve) => {
  const jest = spawn(
    'npx',
    [
      'jest',
      '--maxWorkers=1',
      '--workerIdleMemoryLimit=512MB',
      '--testTimeout=300000',
      'test/services/SyncConvergenceFuzz',
    ],
    {
      cwd: join(repoRoot, 'apps/client'),
      env: { ...process.env, SYNC_FUZZ_API: origin },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  jest.on('exit', (exitCode) => resolve(exitCode ?? 1));
});
server.removeAllListeners('exit');
server.kill();
process.exit(code);
