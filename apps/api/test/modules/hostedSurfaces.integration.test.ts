import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { truncateAll } from '../helpers/database';

/**
 * The surfaces a Keres server hands out besides its API - the hosted client, the landing page, the
 * showcase, the admin panel, the favicon and the redirects between them - served from build outputs the
 * test makes itself. The real builds are not a given on a machine (a server that never built the landing
 * page must still answer), so these run over fixtures: a full set, and none at all.
 */
type App = Awaited<ReturnType<typeof import('../../src/index').createApp>>;

const root = mkdtempSync(path.join(tmpdir(), 'keres-surfaces-'));
const ICO = Buffer.from([0, 0, 1, 0, 1, 0, 16, 16]);
const BIG_JS = `export const line = 'padding that compresses well';\n`.repeat(200);

function put(relative: string, content: string | Buffer) {
  const file = path.join(root, 'full', relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** The four builds, as the layout `KERES_RESOURCE_ROOT` expects: `client-dist`, `landing-dist`, ... */
function writeFullTree() {
  put('client-dist/index.html', '<html><head><title>client</title></head><body>app</body></html>');
  put('client-dist/_expo/static/js/app-abc123.js', BIG_JS);
  put('client-dist/assets/logo.png', Buffer.from([137, 80, 78, 71, 1, 2, 3]));
  put('client-dist/data/info.json', JSON.stringify({ hello: 'x'.repeat(800) }));
  put('client-dist/other/blob.bin', Buffer.from([1, 2, 3]));
  put('landing-dist/index.html', '<html><body>landing</body></html>');
  put('landing-dist/favicon.ico', ICO);
  put('landing-dist/assets/land.js', BIG_JS);
  put('dist-showcase/index.html', '<html><body>showcase</body></html>');
  put('dist-showcase/favicon.ico', ICO);
  put('dist-showcase/assets/show.css', 'body{color:red}\n'.repeat(80));
  put('admin-dist/index.html', '<html><body>admin</body></html>');
  put('admin-dist/favicon.ico', ICO);
  put('admin-dist/assets/panel.js', BIG_JS);
}

/** The app as a server that has (or has not) built every surface would create it. */
async function loadApp(resources: 'full' | 'none'): Promise<App> {
  vi.resetModules();
  vi.doUnmock('../../src/config/resourceRoot');
  if (resources === 'full') {
    process.env.KERES_RESOURCE_ROOT = path.join(root, 'full');
  } else {
    const nowhere = path.join(root, 'nowhere');
    vi.doMock('../../src/config/resourceRoot', async (original) => ({
      ...(await original<typeof import('../../src/config/resourceRoot')>()),
      adminDistPath: () => path.join(nowhere, 'admin'),
      showcaseDistPath: () => path.join(nowhere, 'showcase'),
      landingDistPath: () => path.join(nowhere, 'landing'),
      clientDistPath: () => path.join(nowhere, 'client'),
      desktopIconPath: () => path.join(nowhere, 'icon.png'),
    }));
  }
  const { createApp } = await import('../../src/index');
  return createApp();
}

async function get(app: App, pathname: string, headers: Record<string, string> = {}) {
  const response = await app.handle(
    new Request(`http://localhost${pathname}`, { headers, redirect: 'manual' }),
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    status: response.status,
    headers: response.headers,
    bytes,
    text: new TextDecoder().decode(bytes),
  };
}

const setSettings = (values: { landing?: boolean; hostedClient?: boolean; showcase?: boolean }) =>
  db
    .insert(showcaseSettings)
    .values({
      id: SHOWCASE_SETTINGS_SINGLETON_ID,
      isLandingEnabled: values.landing ?? false,
      isHostedClientEnabled: values.hostedClient ?? true,
      isShowcaseEnabled: values.showcase ?? false,
    })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: {
        isLandingEnabled: values.landing ?? false,
        isHostedClientEnabled: values.hostedClient ?? true,
        isShowcaseEnabled: values.showcase ?? false,
      },
    });

const previousRoot = process.env.KERES_RESOURCE_ROOT;

beforeAll(() => {
  writeFullTree();
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env.KERES_RESOURCE_ROOT;
  else process.env.KERES_RESOURCE_ROOT = previousRoot;
  vi.doUnmock('../../src/config/resourceRoot');
  rmSync(root, { recursive: true, force: true });
});

beforeEach(async () => {
  await truncateAll();
});

describe('a server with every surface built', () => {
  let app: App;
  beforeAll(async () => {
    app = await loadApp('full');
  });

  describe('where the root leads', () => {
    it('shows the landing page when the administrator turned it on', async () => {
      await setSettings({ landing: true });

      const { status, text, headers } = await get(app, '/');

      expect(status).toBe(200);
      expect(text).toContain('landing');
      expect(headers.get('content-type')).toContain('text/html');
      expect(headers.get('content-security-policy')).toContain("default-src 'self'");
    });

    it('sends the visitor to the hosted client when there is no landing page', async () => {
      await setSettings({});

      const { status, headers } = await get(app, '/');

      expect(status).toBe(302);
      expect(headers.get('location')).toBe('/client/');
    });

    it('falls through to the showcase, then to the API docs, as each is switched off', async () => {
      await setSettings({ hostedClient: false, showcase: true });
      expect((await get(app, '/')).headers.get('location')).toBe('/showcase');

      await setSettings({ hostedClient: false, showcase: false });
      expect((await get(app, '/')).headers.get('location')).toBe('/api/swagger');
    });
  });

  describe('the hosted client', () => {
    it('serves its entry with the marker, the history guard and the isolation headers', async () => {
      const { status, text, headers } = await get(app, '/client/');

      expect(status).toBe(200);
      expect(text).toContain('<meta name="keres-hosted" content="1" />');
      expect(text).toContain('history.pushState=function()');
      expect(headers.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(headers.get('cross-origin-embedder-policy')).toBe('require-corp');
      expect(headers.get('cache-control')).toBe('no-cache');
      expect((await get(app, '/client')).status).toBe(200);
    });

    it('answers a screen of the client, which is not a file, with the entry', async () => {
      const { status, text } = await get(app, '/client/StorySelection/Details');

      expect(status).toBe(200);
      expect(text).toContain('keres-hosted');
    });

    it('compresses what shrinks, in brotli or gzip by what the browser takes, and keeps it', async () => {
      const asset = '/client/_expo/static/js/app-abc123.js';

      const br = await get(app, asset, { 'accept-encoding': 'gzip, br' });
      expect(br.headers.get('content-encoding')).toBe('br');
      expect(br.headers.get('vary')).toBe('Accept-Encoding');
      expect(br.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(br.bytes.length).toBeLessThan(BIG_JS.length);

      const gz = await get(app, asset, { 'accept-encoding': 'gzip' });
      expect(gz.headers.get('content-encoding')).toBe('gzip');
      expect(new TextDecoder().decode(gunzipSync(gz.bytes))).toBe(BIG_JS);

      const plain = await get(app, asset);
      expect(plain.headers.get('content-encoding')).toBeNull();
      expect(plain.text).toBe(BIG_JS);
    });

    it('answers 304, with no body, to a browser that already has the file', async () => {
      const first = await get(app, '/client/data/info.json', { 'accept-encoding': 'gzip' });
      const etag = first.headers.get('etag')!;
      expect(etag).toMatch(/-gzip"$/);

      const again = await get(app, '/client/data/info.json', {
        'accept-encoding': 'gzip',
        'if-none-match': etag,
      });

      expect(again.status).toBe(304);
      expect(again.bytes.length).toBe(0);
    });

    it('serves what is already compressed or too small to bother with as it is', async () => {
      const png = await get(app, '/client/assets/logo.png', { 'accept-encoding': 'gzip, br' });
      expect(png.status).toBe(200);
      expect(png.headers.get('content-encoding')).toBeNull();
      expect(png.headers.get('content-type')).toBe('image/png');
      expect(png.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const blob = await get(app, '/client/other/blob.bin');
      expect(blob.headers.get('content-type')).toBe('application/octet-stream');
    });

    it('does not leave its folder, and says 404 for a file that is not there', async () => {
      // The address is normalised before it is routed, so this lands on a path nobody answers.
      const climb = await get(app, '/client/%2e%2e/%2e%2e/secret.txt');
      expect([302, 404]).toContain(climb.status);
      expect((await get(app, '/client/missing.js')).status).toBe(404);
    });

    it('keeps serving what the entry loads when the administrator turns the entry off', async () => {
      await setSettings({ hostedClient: false });

      expect((await get(app, '/client/')).status).toBe(404);
      expect((await get(app, '/client/_expo/static/js/app-abc123.js')).status).toBe(200);
    });
  });

  describe('the landing page, the showcase and the panel', () => {
    it('serves the static files of the landing page and of the showcase, and 404s the rest', async () => {
      expect((await get(app, '/_landing/assets/land.js')).status).toBe(200);
      expect((await get(app, '/_landing/assets/none.js')).status).toBe(404);
      const css = await get(app, '/_showcase/assets/show.css', { 'accept-encoding': 'gzip' });
      expect(css.status).toBe(200);
      expect(css.headers.get('content-type')).toContain('text/css');
      expect((await get(app, '/_showcase/none.css')).status).toBe(404);
    });

    it('serves the showcase page only while it is enabled', async () => {
      await setSettings({ showcase: true });
      const on = await get(app, '/showcase');
      expect(on.status).toBe(200);
      expect(on.text).toContain('showcase');
      expect((await get(app, '/showcase/story/abc')).text).toContain('showcase');

      await setSettings({ showcase: false });
      expect((await get(app, '/showcase')).status).toBe(404);
      expect((await get(app, '/showcase/story/abc')).status).toBe(404);
    });

    it('serves the panel, its files and its own routes, and never an old API path as a page', async () => {
      const entry = await get(app, '/admin');
      expect(entry.status).toBe(200);
      expect(entry.text).toContain('admin');
      expect(entry.headers.get('x-frame-options')).toBe('DENY');

      expect((await get(app, '/admin/users/42')).text).toContain('admin');
      const asset = await get(app, '/admin/assets/panel.js', { 'accept-encoding': 'br' });
      expect(asset.headers.get('content-encoding')).toBe('br');

      const old = await get(app, '/admin/api/users');
      expect(old.status).toBe(404);
      expect(JSON.parse(old.text)).toEqual({ message: 'Not found' });
      expect((await get(app, '/admin/api')).status).toBe(404);
    });
  });

  describe('the favicon and the redirects', () => {
    it('serves the generated icon as an icon', async () => {
      const { status, headers, bytes } = await get(app, '/favicon.ico');

      expect(status).toBe(200);
      expect(headers.get('content-type')).toBe('image/x-icon');
      expect(Buffer.from(bytes).equals(ICO)).toBe(true);
    });

    it('sends the old client addresses, and any path nobody answers, to the root', async () => {
      for (const old of ['/app', '/app/story/1', '/some/old/bookmark']) {
        const { status, headers } = await get(app, old);
        expect([old, status, headers.get('location')]).toEqual([old, 302, '/']);
      }
    });

    it('keeps an unknown API path a JSON 404 rather than a redirect', async () => {
      const { status, text } = await get(app, '/api/does-not-exist');

      expect(status).toBe(404);
      expect(text).toContain('Not found');
    });
  });
});

describe('a server that built none of them', () => {
  let app: App;
  beforeAll(async () => {
    app = await loadApp('none');
  });

  it('still answers at the root, with the API docs', async () => {
    await setSettings({ landing: true, showcase: true });

    const { status, headers } = await get(app, '/');

    expect(status).toBe(302);
    expect(headers.get('location')).toBe('/api/swagger');
  });

  it('says there is nothing to serve where a surface was never built', async () => {
    for (const pathname of [
      '/client/',
      '/client/app.js',
      '/_landing/x.js',
      '/_showcase/x.js',
      '/favicon.ico',
      '/unknown/path',
    ]) {
      expect([pathname, (await get(app, pathname)).status]).toEqual([pathname, 404]);
    }
    const panel = await get(app, '/admin');
    expect(panel.status).toBe(404);
    expect(panel.text).toContain('Admin UI not built');
    await setSettings({ showcase: true });
    expect((await get(app, '/showcase')).status).toBe(404);
  });
});
