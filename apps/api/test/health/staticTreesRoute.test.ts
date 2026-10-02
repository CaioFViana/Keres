import { existsSync, readdirSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { adminDistPath, landingDistPath, showcaseDistPath } from '../../src/config/resourceRoot';
import { createApp } from '../../src/index';

/**
 * The static trees of the admin panel, the showcase and the landing page: what they load comes
 * compressed and cacheable, and the panel still falls back to its SPA for a route that is not a file.
 * Each block is skipped when that bundle was never built, like the hosted client's.
 */
const get = async (path: string, headers: Record<string, string> = {}) => {
  const app = await createApp();
  return app.handle(new Request(`http://localhost${path}`, { headers }));
};

const hashedAsset = (dist: string, extension: string) =>
  existsSync(`${dist}/assets`)
    ? readdirSync(`${dist}/assets`).find((name) => name.endsWith(extension))
    : undefined;

describe.each([
  ['/admin', adminDistPath(), 'admin panel'],
  ['/_showcase', showcaseDistPath(), 'public site'],
  ['/_landing', landingDistPath(), 'landing page'],
])('%s static files (%s)', (prefix, dist, label) => {
  const built = existsSync(`${dist}/index.html`);

  it(`compresses the ${label}'s script in brotli and keeps it for a year`, async () => {
    if (!built) return;
    const script = hashedAsset(dist, '.js');
    expect(script).toBeTruthy();

    const response = await get(`${prefix}/assets/${script}`, { 'accept-encoding': 'gzip, br' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe('br');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('vary')).toBe('Accept-Encoding');
    const decoded = brotliDecompressSync(new Uint8Array(await response.arrayBuffer()));
    expect(decoded.length).toBeGreaterThan(10_000);
  });

  it('answers 304 to a browser that comes back with the tag', async () => {
    if (!built) return;
    const script = `${prefix}/assets/${hashedAsset(dist, '.js')}`;
    const first = await get(script, { 'accept-encoding': 'br' });

    const again = await get(script, {
      'accept-encoding': 'br',
      'if-none-match': first.headers.get('etag')!,
    });

    expect(again.status).toBe(304);
    expect((await again.arrayBuffer()).byteLength).toBe(0);
  });

  it('keeps the security headers on what it serves', async () => {
    if (!built) return;

    const response = await get(`${prefix}/assets/${hashedAsset(dist, '.js')}`);

    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('the paths under /_showcase and /_landing that are not files', () => {
  it('say 404 rather than sending the browser somewhere else', async () => {
    if (existsSync(`${showcaseDistPath()}/index.html`)) {
      expect((await get('/_showcase/assets/missing.js')).status).toBe(404);
    }
    if (existsSync(`${landingDistPath()}/index.html`)) {
      expect((await get('/_landing/assets/missing.js')).status).toBe(404);
      // Not a file of the tree: the router itself sends a path that climbs out of it elsewhere.
      expect((await get('/_landing/%2e%2e/%2e%2e/package.json')).status).not.toBe(200);
    }
  });
});

describe('the admin panel around its static files', () => {
  it('still falls back to the SPA for a panel route, and never for the removed API', async () => {
    if (!existsSync(`${adminDistPath()}/index.html`)) return;

    const route = await get('/admin/users');
    expect(route.status).toBe(200);
    expect(route.headers.get('content-type')).toContain('text/html');
    expect(await route.text()).toContain('<div id="root">');

    const api = await get('/admin/api/users');
    expect(api.status).toBe(404);
    expect((await api.json()) as { message: string }).toEqual({ message: 'Not found' });
  });
});
