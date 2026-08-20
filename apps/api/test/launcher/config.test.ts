import { mkdtempSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyLauncherEnv,
  generateSecret,
  saveLauncherFiles,
  type LauncherPublicConfig,
  type LauncherSecrets,
} from '../../src/launcher/config';

const secrets: LauncherSecrets = {
  jwtSecret: generateSecret(),
  jwtSecretRefresh: generateSecret(),
  rootAdminPassword: 'adminpass1',
};

function sampleConfig(dataDir: string): LauncherPublicConfig {
  return {
    language: 'pt',
    databaseDriver: 'sqlite',
    databaseUrl: `file:${dataDir.replace(/\\/g, '/')}/keres.db`,
    mediaStorageDriver: 'local',
    mediaStoragePath: path.join(dataDir, 'media-storage'),
    host: '127.0.0.1',
    port: '3000',
    dataDir,
    rootAdminUsername: 'root',
  };
}

describe('launcher config', () => {
  const previous = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, previous);
  });

  it('writes config and secrets, then injects env the API already understands', () => {
    const dataDir = mkdtempSync(path.join(os.tmpdir(), 'keres-cfg-'));
    const config = sampleConfig(dataDir);
    saveLauncherFiles(config, secrets);
    applyLauncherEnv(config, secrets);

    expect(process.env.DATABASE_DRIVER).toBe('sqlite');
    expect(process.env.DATABASE_URL).toContain('keres.db');
    expect(process.env.JWT_SECRET).toBe(secrets.jwtSecret);
    expect(process.env.HOST).toBe('127.0.0.1');
    expect(process.env.MEDIA_STORAGE_DRIVER).toBe('local');
    expect(process.env.ROOT_ADMIN_USERNAME).toBe('root');
    expect(process.env.ROOT_ADMIN_PASSWORD).toBe('adminpass1');
  });
});
