import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateSecret,
  type LauncherPublicConfig,
  type LauncherSecrets,
} from '../../src/launcher/config';
import type { LauncherIo } from '../../src/launcher/io';
import { runLauncher } from '../../src/launcher/run';
import { assertDriverNotChanged } from '../../src/launcher/wizard';
import { createTranslator } from '../../src/launcher/i18n';

function fakeIo(answers: string[] = [], interactive = true): { lines: string[]; io: LauncherIo } {
  const lines: string[] = [];
  const queue = [...answers];
  return {
    lines,
    io: {
      print: (message) => lines.push(message),
      prompt: async () => queue.shift() ?? '',
      isInteractive: () => interactive,
    },
  };
}

function writeConfig(dataDir: string): string {
  mkdirSync(dataDir, { recursive: true });
  const config: LauncherPublicConfig = {
    language: 'en',
    databaseDriver: 'sqlite',
    databaseUrl: `file:${dataDir.replace(/\\/g, '/')}/keres.db`,
    mediaStorageDriver: 'local',
    mediaStoragePath: path.join(dataDir, 'media-storage'),
    host: '127.0.0.1',
    port: '3000',
    dataDir,
    rootAdminUsername: 'root',
  };
  const secrets: LauncherSecrets = {
    jwtSecret: generateSecret(),
    jwtSecretRefresh: generateSecret(),
    rootAdminPassword: 'adminpass1',
  };
  const configPath = path.join(dataDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify(secrets, null, 2));
  return configPath;
}

describe('runLauncher', () => {
  const previousExit = process.exitCode;
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.exitCode = previousExit;
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, previousEnv);
  });

  it('runs --backup without starting the HTTP server', async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'keres-run-bak-'));
    writeFileSync(path.join(dataDir, 'keres.db'), 'db');
    const configPath = writeConfig(dataDir);
    const parent = mkdtempSync(path.join(os.tmpdir(), 'keres-out-bak-'));
    const { lines, io } = fakeIo([], false);
    let booted = false;
    await runLauncher(['--backup', parent, '--config', configPath], {
      io,
      boot: async () => {
        booted = true;
      },
    });
    expect(booted).toBe(false);
    expect(lines.join('\n')).toMatch(/Backup saved at/);
  });

  it('prints help without booting', async () => {
    const { lines, io } = fakeIo();
    let booted = false;
    await runLauncher(['--help'], {
      io,
      boot: async () => {
        booted = true;
      },
    });
    expect(booted).toBe(false);
    expect(lines.join('\n')).toMatch(/Keres Server/);
  });

  it('refuses --non-interactive when there is no config', async () => {
    const { lines, io } = fakeIo([], false);
    await runLauncher(
      ['--non-interactive', '--config', path.join(os.tmpdir(), 'keres-missing-config.json')],
      {
        io,
        boot: async () => undefined,
      },
    );
    expect(process.exitCode).toBe(1);
    expect(lines.join('\n')).toMatch(/config\.json/);
  });

  it('starts from an existing config without prompting', async () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'keres-run-'));
    const configPath = writeConfig(dataDir);
    const { lines, io } = fakeIo([], false);
    let booted = false;
    await runLauncher(['--config', configPath, '--non-interactive'], {
      io,
      boot: async () => {
        booted = true;
      },
    });
    expect(booted).toBe(true);
    expect(lines.some((line) => line.includes('Starting'))).toBe(true);
    expect(process.env.DATABASE_DRIVER).toBe('sqlite');
  });

  it('refuses switching database engines in an existing data folder', () => {
    const t = createTranslator('en');
    expect(() =>
      assertDriverNotChanged(
        {
          language: 'en',
          databaseDriver: 'sqlite',
          databaseUrl: 'file:./keres.db',
          mediaStorageDriver: 'local',
          host: '127.0.0.1',
          port: '3000',
          dataDir: '/tmp/x',
        },
        {
          language: 'en',
          databaseDriver: 'postgres',
          databaseUrl: 'postgres://x',
          mediaStorageDriver: 'local',
          host: '127.0.0.1',
          port: '3000',
          dataDir: '/tmp/x',
        },
        t,
      ),
    ).toThrow(/sqlite/);
  });
});
