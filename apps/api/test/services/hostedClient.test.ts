import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_APP_ISOLATION_HEADERS,
  isClientDistRootAssetPath,
  readClientDistRootAsset,
  readHostedClientFile,
  rewriteHostedClientHtml,
  resolveHostedClientFile,
} from '../../src/services/hostedClient';

describe('rewriteHostedClientHtml', () => {
  it('prefixes root-absolute asset URLs with /app without touching already-prefixed ones', () => {
    const html =
      '<script src="/_expo/entry.js"></script><link href="/app/favicon.ico"/><a href="/stories">';
    expect(rewriteHostedClientHtml(html)).toBe(
      '<script src="/app/_expo/entry.js"></script><link href="/app/favicon.ico"/><a href="/app/stories">',
    );
  });
});

describe('resolveHostedClientFile', () => {
  it('serves index.html for /app and real files under it, refusing path escape', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-hosted-'));
    writeFileSync(path.join(root, 'index.html'), '<script src="/_expo/a.js"></script>');
    mkdirSync(path.join(root, '_expo'));
    writeFileSync(path.join(root, '_expo', 'a.js'), 'console.log(1)');

    expect(resolveHostedClientFile(root, '/app')?.html).toBe(true);
    expect(readHostedClientFile(root, '/app')?.body).toContain('/app/_expo/a.js');
    expect(readHostedClientFile(root, '/app/_expo/a.js')?.contentType).toContain('javascript');
    expect(resolveHostedClientFile(root, '/app/../secret')).toBeNull();
  });

  it('falls a client route back to index.html', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-hosted-spa-'));
    writeFileSync(path.join(root, 'index.html'), '<div id="root"></div>');
    const resolved = resolveHostedClientFile(root, '/app/stories');
    expect(resolved?.html).toBe(true);
    expect(resolved?.filePath).toBe(path.join(root, 'index.html'));
  });

  it('declares the isolation headers expo-sqlite needs', () => {
    expect(CLIENT_APP_ISOLATION_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(CLIENT_APP_ISOLATION_HEADERS['Cross-Origin-Embedder-Policy']).toBe('require-corp');
  });
});

describe('readClientDistRootAsset', () => {
  it('serves /_expo and /assets from the dist root and refuses escape', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-root-asset-'));
    mkdirSync(path.join(root, '_expo'), { recursive: true });
    writeFileSync(path.join(root, '_expo', 'worker.js'), 'onmessage=()=>{}');
    expect(isClientDistRootAssetPath('/_expo/worker.js')).toBe(true);
    expect(readClientDistRootAsset(root, '/_expo/worker.js')?.contentType).toContain('javascript');
    expect(readClientDistRootAsset(root, '/_expo/../secret')).toBeNull();
  });
});
