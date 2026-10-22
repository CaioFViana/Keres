import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WEB_BUNDLES, webBundlePath } from '@/config/resourceRoot';
import { loadWebSurfaces } from '@/web/webSurfaces';

function bundleRoot(folders: readonly string[]): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'keres-surfaces-unit-'));
  for (const folder of folders) {
    mkdirSync(path.join(root, folder));
    writeFileSync(path.join(root, folder, 'index.html'), '<html></html>');
  }
  return root;
}

describe('web bundles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names every packaged folder dist-<bundle>, like the build folders of the apps', () => {
    for (const [name, bundle] of Object.entries(WEB_BUNDLES)) {
      expect(bundle.packaged).toBe(`dist-${name}`);
    }
  });

  it('finds each bundle under the resource override by its packaged name', () => {
    const root = bundleRoot(Object.values(WEB_BUNDLES).map((bundle) => bundle.packaged));
    vi.stubEnv('KERES_RESOURCE_ROOT', root);
    for (const [name, bundle] of Object.entries(WEB_BUNDLES)) {
      expect(webBundlePath(name as keyof typeof WEB_BUNDLES)).toBe(
        path.join(root, bundle.packaged),
      );
    }
  });

  it('falls back to the checkout build folder when nothing is packaged', () => {
    vi.stubEnv('KERES_RESOURCE_ROOT', bundleRoot([]));
    const found = webBundlePath('landing').replaceAll('\\', '/');
    expect(found).toMatch(/apps\/site\/dist-landing$/);
  });
});

describe('loadWebSurfaces', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('marks as available only the bundles that have an index.html', () => {
    vi.stubEnv('KERES_RESOURCE_ROOT', bundleRoot(['dist-admin', 'dist-showcase']));
    const surfaces = loadWebSurfaces();
    expect(surfaces.admin.available).toBe(true);
    expect(surfaces.showcase.available).toBe(true);
    expect(surfaces.admin.indexPath).toBe(path.join(surfaces.admin.distPath, 'index.html'));
    expect(surfaces.admin.faviconPath).toBe(path.join(surfaces.admin.distPath, 'favicon.ico'));
  });
});
