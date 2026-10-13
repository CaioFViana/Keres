import { mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type VerificationConfig } from '../src/config';
import { BackupError } from '../src/backup/layout';
import { rotateBackups } from '../src/backup/rotateBackups';
import { runBackupRound, startBackupScheduler } from '../src/backup/scheduler';
import { testEnv, T0 } from './helpers/harness';

/**
 * The timer runs one round at a time, after the first delay and then every interval, and stops on shutdown after a round
 * in progress has finished. A failing round is logged and the timer goes on. Time is faked; the rounds are stubs, except
 * where the real rotation is needed.
 */

let root: string;
let config: VerificationConfig;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  root = mkdtempSync(join(tmpdir(), 'keres-backup-scheduler-'));
  const data = resolve(join(root, 'live', 'data'));
  const keys = resolve(join(root, 'live', 'keys'));
  config = loadConfig({
    ...testEnv(data, keys),
    BACKUP_DIR: join(root, 'backups'),
  } as NodeJS.ProcessEnv);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('startBackupScheduler', () => {
  it('runs the first round after the first delay, then one per interval, and stops on shutdown', async () => {
    const rounds: number[] = [];
    const scheduler = startBackupScheduler(config, {
      firstDelayMs: 1000,
      intervalMs: 5000,
      round: async (now) => {
        rounds.push(now);
      },
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(rounds).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(rounds).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(rounds).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rounds).toHaveLength(2);

    await scheduler.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rounds).toHaveLength(2);
  });

  it('stop waits for a round in progress, and schedules nothing after it', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const scheduler = startBackupScheduler(config, {
      firstDelayMs: 10,
      intervalMs: 100,
      round: async () => {
        calls += 1;
        await gate;
      },
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(calls).toBe(1);
    let stopped = false;
    const stopping = scheduler.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopped).toBe(false);

    release();
    await stopping;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
  });

  it('a round that throws is logged and the timer goes on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    const scheduler = startBackupScheduler(config, {
      firstDelayMs: 10,
      intervalMs: 100,
      round: async () => {
        calls += 1;
        if (calls === 1) throw new Error('unexpected');
      },
    });

    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(2);
    expect(error).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });

  it('takes its interval from BACKUP_INTERVAL_HOURS when no interval is given', async () => {
    const hourly = { ...config, backupIntervalHours: 1 };
    let calls = 0;
    const scheduler = startBackupScheduler(hourly, {
      firstDelayMs: 0,
      round: async () => {
        calls += 1;
      },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await scheduler.stop();
  });
});

describe('runBackupRound', () => {
  it('rotates even when the backup of the same round failed', async () => {
    mkdirSync(join(config.backupDir as string, 'verification-20260101T000000Z'), {
      recursive: true,
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await runBackupRound(config, T0, {
      takeBackup: async () => {
        throw new BackupError('BACKUP_DIR is not set: backups are off.');
      },
      rotateBackups,
    });

    expect(existsSync(join(config.backupDir as string, 'verification-20260101T000000Z'))).toBe(
      false,
    );
    expect(readdirSync(config.backupDir as string)).toEqual([]);
  });

  it('logs a failure by its label only: no message text, no path, no name from the error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fsError = Object.assign(new Error('EACCES at /srv/keys/Ana Souza.png'), {
      code: 'EACCES',
    });

    await runBackupRound(config, T0, {
      takeBackup: async () => {
        throw fsError;
      },
      rotateBackups: async () => {
        throw new Error('Ana Souza, /home/ana/private');
      },
    });

    const lines = error.mock.calls.map((call) => String(call[0]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('EACCES');
    expect(lines.join('\n')).not.toContain('Ana Souza');
    expect(lines.join('\n')).not.toContain('/srv/keys');
    expect(lines.join('\n')).not.toContain('/home/ana');
  });

  it('logs a successful round with the name of the backup and the counts only', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runBackupRound(config, T0, {
      takeBackup: async () => ({
        folder: join(config.backupDir as string, 'verification-20261012T120000Z'),
        name: 'verification-20261012T120000Z',
        blobsCopied: 3,
        blobsGone: 1,
      }),
      rotateBackups: async () => ['verification-20260101T000000Z'],
    });

    const text = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(text).toContain('verification-20261012T120000Z');
    expect(text).toContain('3 image file(s)');
    expect(text).toContain('Rotated out 1 backup entry');
    expect(text).not.toContain(root);
  });
});
