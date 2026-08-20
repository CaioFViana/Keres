import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminDistPath, firstExistingPath, migrationsFolder } from '../../src/config/resourceRoot';

describe('resourceRoot', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the first path that exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-resource-'));
    const missing = path.join(root, 'nope');
    const present = path.join(root, 'here');
    mkdirSync(present);
    expect(firstExistingPath([missing, present])).toBe(present);
    expect(firstExistingPath([missing])).toBeUndefined();
  });

  it('finds checkout migrations without KERES_RESOURCE_ROOT', () => {
    const folder = migrationsFolder(true);
    expect(folder.replace(/\\/g, '/')).toMatch(/drizzle-sqlite$/);
  });

  it('prefers KERES_RESOURCE_ROOT when the packaged layout is present', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-pack-'));
    const sqlite = path.join(root, 'drizzle-sqlite');
    mkdirSync(sqlite);
    writeFileSync(path.join(sqlite, 'meta.json'), '{}');
    vi.stubEnv('KERES_RESOURCE_ROOT', root);
    expect(migrationsFolder(true)).toBe(sqlite);
  });

  it('finds admin-dist under the resource override', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-admin-'));
    const dist = path.join(root, 'admin-dist');
    mkdirSync(dist);
    writeFileSync(path.join(dist, 'index.html'), '<html></html>');
    vi.stubEnv('KERES_RESOURCE_ROOT', root);
    expect(adminDistPath()).toBe(dist);
  });
});
