import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The real server, in a process, ended the way an operator ends it. What it proves that the unit tests of
 * `shutdown.ts` cannot: the whole wiring in `boot.ts` - the signal handlers, the activity record's last
 * lines written before the exit, the database closed, the exit code - against a real SQLite file.
 */

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

let directory: string | null = null;
let child: ChildProcessWithoutNullStreams | null = null;

afterEach(() => {
  child?.kill('SIGKILL');
  child = null;
  if (directory) {
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      // Windows may still hold the database file for a moment; a leftover temp folder is no failure.
    }
  }
  directory = null;
});

function start(port: number) {
  directory = mkdtempSync(join(tmpdir(), 'keres-shutdown-'));
  const databaseFile = join(directory, 'keres.db');
  const spawned = spawn('bun', ['run', 'test/helpers/shutdownHarness.ts'], {
    cwd: join(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_DRIVER: 'sqlite',
      DATABASE_URL: `file:${databaseFile}`,
      JWT_SECRET: 'shutdown-test-secret-with-at-least-thirty-two-characters',
      JWT_SECRET_REFRESH: 'shutdown-test-refresh-secret-with-thirty-two-characters',
      PORT: String(port),
      HOST: '127.0.0.1',
      MEDIA_STORAGE_PATH: join(directory, 'media'),
      SHUTDOWN_GRACE_MS: '3000',
      NODE_ENV: 'test',
    },
  });
  child = spawned;
  let output = '';
  spawned.stdout.on('data', (chunk) => (output += chunk));
  spawned.stderr.on('data', (chunk) => (output += chunk));
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`never ready:\n${output}`)), 45_000);
    const poll = setInterval(() => {
      if (output.includes('READY')) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      }
    }, 50);
    spawned.once('exit', (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(new Error(`exited early (${code}):\n${output}`));
    });
  });
  const exited = new Promise<number | null>((resolve) => spawned.once('exit', resolve));
  return { spawned, ready, exited, databaseFile, output: () => output };
}

describe('the real server stopping', () => {
  it('writes the last lines of the record, closes the database and exits 0', async () => {
    const port = await freePort();
    const { spawned, ready, exited, databaseFile, output } = start(port);
    await ready;

    // A refused login: its line in the record is written after the response, in the background.
    const refused = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nobody-here', password: 'whatever-123' }),
    });
    expect(refused.status).toBe(401);

    // ...and the stop comes at once, before that write has had any reason to finish by itself.
    const stoppedAt = Date.now();
    spawned.stdin.write('stop\n');
    const code = await exited;

    expect(code).toBe(0);
    expect(Date.now() - stoppedAt).toBeLessThan(10_000);
    expect(output()).toContain('Shutting down (SIGTERM)');

    const database = createClient({ url: `file:${databaseFile}` });
    try {
      const { rows } = await database.execute(
        'SELECT action, outcome, actor_username FROM audit_events ORDER BY created_at, id',
      );
      const actions = rows.map((row) => String(row.action));
      expect(actions).toContain('system.server_started');
      expect(actions).toContain('system.server_stopped');
      const login = rows.find((row) => row.action === 'auth.login');
      expect(login).toMatchObject({ outcome: 'failure', actor_username: 'nobody-here' });
      // The stop is the last thing said.
      expect(actions.at(-1)).toBe('system.server_stopped');
    } finally {
      database.close();
    }
  }, 90_000);

  it('refuses new connections once stopped', async () => {
    const port = await freePort();
    const { spawned, ready, exited } = start(port);
    await ready;

    spawned.stdin.write('stop\n');
    await exited;

    await expect(fetch(`http://127.0.0.1:${port}/api/kerescheck`)).rejects.toThrow();
  }, 90_000);
});
