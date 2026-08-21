import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_APP_ISOLATION_HEADERS,
  HOSTED_CLIENT_META,
  isClientDistRootAssetPath,
  isShowcasePath,
  readClientDistRootAsset,
  readHostedClientFile,
  rewriteHostedClientHtml,
  resolveHostedClientFile,
  SHOWCASE_PATH_PREFIX,
} from '../../src/services/hostedClient';

describe('rewriteHostedClientHtml', () => {
  it('marks the page as co-hosted so the client can use the session cookie', () => {
    const html = '<head></head><script src="/_expo/entry.js"></script>';
    const rewritten = rewriteHostedClientHtml(html);
    expect(rewritten).toContain(HOSTED_CLIENT_META);
    expect(rewritten).toContain('src="/_expo/entry.js"');
  });

  it('keeps the browser URL on / so Expo Router never sees a React Navigation path', () => {
    const rewritten = rewriteHostedClientHtml('<head></head>');
    expect(rewritten).toContain('history.replaceState');
    expect(rewritten).toContain('return "/"');
  });
});

describe('resolveHostedClientFile', () => {
  it('serves index.html for / and real files under it, refusing path escape', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-hosted-'));
    writeFileSync(
      path.join(root, 'index.html'),
      '<head></head><script src="/_expo/a.js"></script>',
    );
    mkdirSync(path.join(root, '_expo'));
    writeFileSync(path.join(root, '_expo', 'a.js'), 'console.log(1)');

    expect(resolveHostedClientFile(root, '/')?.html).toBe(true);
    expect(readHostedClientFile(root, '/')?.body).toContain(HOSTED_CLIENT_META);
    expect(readHostedClientFile(root, '/_expo/a.js')?.contentType).toContain('javascript');
    expect(resolveHostedClientFile(root, '/../secret')).toBeNull();
  });

  it('falls a client route back to index.html', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'keres-hosted-spa-'));
    writeFileSync(path.join(root, 'index.html'), '<div id="root"></div>');
    const resolved = resolveHostedClientFile(root, '/stories');
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

describe('isShowcasePath', () => {
  it('matches /showcase and nested pages', () => {
    expect(SHOWCASE_PATH_PREFIX).toBe('/showcase');
    expect(isShowcasePath('/showcase')).toBe(true);
    expect(isShowcasePath('/showcase/about')).toBe(true);
    expect(isShowcasePath('/')).toBe(false);
  });
});
