import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, configWarnings, loadConfig } from '../src/config';
import { testEnv } from './helpers/harness';

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

const withBackups = (backupEnv: Record<string, string | undefined>): NodeJS.ProcessEnv => {
  const env = { ...testEnv(DATA, KEYS), ...backupEnv } as NodeJS.ProcessEnv;
  for (const [name, value] of Object.entries(backupEnv)) {
    if (value === undefined) delete env[name];
  }
  return env;
};

describe('backup configuration', () => {
  it('is off when BACKUP_DIR is unset, with the 90-day default retention and a 24-hour interval', () => {
    const config = loadConfig(withBackups({}));
    expect(config.backupDir).toBeUndefined();
    expect(config.backupRetentionDays).toBe(90);
    expect(config.backupAllowLongerRetention).toBe(false);
    expect(config.backupIntervalHours).toBe(24);
    expect(configWarnings(config)).toContain(
      'BACKUP_DIR is not set: backups are off. The data store is not backed up.',
    );
  });

  it('takes BACKUP_DIR as an absolute folder, and warns nothing about backups when it is set', () => {
    const config = loadConfig(withBackups({ BACKUP_DIR: '/srv/verification/backups' }));
    expect(config.backupDir).toBe(resolve('/srv/verification/backups'));
    expect(configWarnings(config).join('\n')).not.toMatch(/backups are off/);
  });

  it('treats an empty BACKUP_DIR as unset', () => {
    expect(loadConfig(withBackups({ BACKUP_DIR: '' })).backupDir).toBeUndefined();
  });

  it('refuses a BACKUP_DIR inside DATA_DIR or KEY_DIR', () => {
    expect(problemsOf(withBackups({ BACKUP_DIR: join(DATA, 'backups') })).join('\n')).toMatch(
      /BACKUP_DIR must not be, contain or be inside DATA_DIR/,
    );
    expect(problemsOf(withBackups({ BACKUP_DIR: join(KEYS, 'backups') })).join('\n')).toMatch(
      /BACKUP_DIR must not be, contain or be inside KEY_DIR/,
    );
  });

  it('refuses a BACKUP_DIR that is DATA_DIR or KEY_DIR, or contains one of them', () => {
    expect(problemsOf(withBackups({ BACKUP_DIR: DATA }))).toContain(
      'BACKUP_DIR must not be, contain or be inside DATA_DIR: backups must stay apart from the data and the keys.',
    );
    expect(problemsOf(withBackups({ BACKUP_DIR: KEYS }))).toContain(
      'BACKUP_DIR must not be, contain or be inside KEY_DIR: backups must stay apart from the data and the keys.',
    );
    // The parent of both: it contains each of them.
    const parent = withBackups({ BACKUP_DIR: resolve('/srv/verification') });
    const problems = problemsOf(parent).join('\n');
    expect(problems).toMatch(/inside DATA_DIR/);
    expect(problems).toMatch(/inside KEY_DIR/);
  });

  it('accepts a sibling folder, and one that only shares a name prefix with DATA_DIR', () => {
    expect(() => loadConfig(withBackups({ BACKUP_DIR: `${DATA}-backups` }))).not.toThrow();
    expect(() =>
      loadConfig(withBackups({ BACKUP_DIR: resolve('/srv/verification/backups') })),
    ).not.toThrow();
  });

  it('refuses a retention past the 90-day ceiling unless BACKUP_ALLOW_LONGER_RETENTION is true', () => {
    expect(problemsOf(withBackups({ BACKUP_RETENTION_DAYS: '91' }))).toContain(
      'BACKUP_RETENTION_DAYS must be at most 90: a longer retention needs BACKUP_ALLOW_LONGER_RETENTION=true and a written justification.',
    );
    expect(
      problemsOf(
        withBackups({ BACKUP_RETENTION_DAYS: '365', BACKUP_ALLOW_LONGER_RETENTION: 'yes' }),
      ).join('\n'),
    ).toMatch(/must be at most 90/);
  });

  it('accepts a longer retention with the flag, and warns about it at boot', () => {
    const config = loadConfig(
      withBackups({ BACKUP_RETENTION_DAYS: '365', BACKUP_ALLOW_LONGER_RETENTION: 'true' }),
    );
    expect(config.backupRetentionDays).toBe(365);
    expect(configWarnings(config).join('\n')).toMatch(/past the 90-day ceiling/);
  });

  it('accepts exactly 90 days without the flag, and a shorter retention', () => {
    expect(loadConfig(withBackups({ BACKUP_RETENTION_DAYS: '90' })).backupRetentionDays).toBe(90);
    expect(loadConfig(withBackups({ BACKUP_RETENTION_DAYS: '30' })).backupRetentionDays).toBe(30);
  });

  it('refuses a retention or an interval that is not a whole number in range', () => {
    expect(problemsOf(withBackups({ BACKUP_RETENTION_DAYS: '0' }))).toContain(
      'BACKUP_RETENTION_DAYS must be a whole number from 1 to 3650.',
    );
    expect(problemsOf(withBackups({ BACKUP_RETENTION_DAYS: '90days' }))).toContain(
      'BACKUP_RETENTION_DAYS must be a whole number from 1 to 3650.',
    );
    expect(problemsOf(withBackups({ BACKUP_INTERVAL_HOURS: '0' }))).toContain(
      'BACKUP_INTERVAL_HOURS must be a whole number from 1 to 480.',
    );
    expect(problemsOf(withBackups({ BACKUP_INTERVAL_HOURS: '481' }))).toContain(
      'BACKUP_INTERVAL_HOURS must be a whole number from 1 to 480.',
    );
    expect(loadConfig(withBackups({ BACKUP_INTERVAL_HOURS: '480' })).backupIntervalHours).toBe(480);
  });

  it('reads the interval in hours', () => {
    expect(loadConfig(withBackups({ BACKUP_INTERVAL_HOURS: '6' })).backupIntervalHours).toBe(6);
  });
});
