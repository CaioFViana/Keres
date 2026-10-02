import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { clientDistPath } from '../../src/config/resourceRoot';
import { createApp } from '../../src/index';
import { HOSTED_CLIENT_META } from '../../src/services/hostedClient';

const clientBuilt = () => existsSync(`${clientDistPath()}/index.html`);

describe('GET /client/', () => {
  it('serves the hosted client HTML with isolation headers when the export exists', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/client/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    const html = await response.text();
    expect(html).toContain(HOSTED_CLIENT_META);
    // The export was made for this prefix: every URL in it already carries it.
    expect(html).toContain('/client/_expo/');
    expect(html).not.toMatch(/(?:src|href)="\/_expo\//);
  });

  it('answers /client the same as /client/, with no redirect between them', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    for (const path of ['/client', '/client/']) {
      const response = await app.handle(
        new Request('http://localhost' + path, { redirect: 'manual' }),
      );
      expect([path, response.status]).toEqual([path, 200]);
    }
  });

  it('answers a screen path under it with the entry page, so a reload still lands', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/client/StorySelection'));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(HOSTED_CLIENT_META);
  });
});

describe('GET /', () => {
  it('is no longer the client: it sends people on to /client/', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/', { redirect: 'manual' }));
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', 'http://localhost').pathname).toBe(
      '/client/',
    );
  });

  it('redirects the legacy /app path to the origin root', async () => {
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/app', { redirect: 'manual' }));
    expect([301, 302, 307, 308]).toContain(response.status);
    const location = response.headers.get('location') ?? '';
    expect(new URL(location, 'http://localhost').pathname).toBe('/');
  });

  it('sends unknown paths back to /, which is where the root sends them on', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(
      new Request('http://localhost/StorySelection', { redirect: 'manual' }),
    );
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', 'http://localhost').pathname).toBe('/');
  });

  it('no longer serves the client runtime from the root: those paths are free', async () => {
    if (!clientBuilt()) {
      return;
    }
    const app = await createApp();
    for (const path of ['/_expo/static/js/web/anything.js', '/assets/anything.png']) {
      const response = await app.handle(
        new Request(`http://localhost${path}`, { redirect: 'manual' }),
      );
      expect([path, response.status === 200]).toEqual([path, false]);
    }
  });
});

describe('how the client is delivered', () => {
  const bundlePath = () => {
    const html = readFileSync(`${clientDistPath()}/index.html`, 'utf8');
    const match = html.match(/src="(\/client\/_expo\/static\/js\/web\/index-[^"]+\.js)"/);
    if (!match) throw new Error('the export has no bundle');
    return match[1];
  };
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const app = await createApp();
    return app.handle(new Request(`http://localhost${path}`, { headers }));
  };

  it('compresses the bundle for a browser that takes brotli, and the bytes are the file', async () => {
    if (!clientBuilt()) return;
    const path = bundlePath();
    const original = readFileSync(`${clientDistPath()}/${path.replace('/client/', '')}`);

    const response = await get(path, { 'accept-encoding': 'gzip, deflate, br' });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBe('br');
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body.length).toBeLessThan(original.length / 2);
    expect(Buffer.from(brotliDecompressSync(body)).equals(original)).toBe(true);
  });

  it('compresses it in gzip for one on plain HTTP, and not at all for one that accepts nothing', async () => {
    if (!clientBuilt()) return;
    const path = bundlePath();
    const original = readFileSync(`${clientDistPath()}/${path.replace('/client/', '')}`);

    const gzipped = await get(path, { 'accept-encoding': 'gzip, deflate' });
    expect(gzipped.headers.get('content-encoding')).toBe('gzip');
    expect(
      Buffer.from(gunzipSync(new Uint8Array(await gzipped.arrayBuffer()))).equals(original),
    ).toBe(true);

    const plain = await get(path, { 'accept-encoding': 'identity' });
    expect(plain.headers.get('content-encoding')).toBeNull();
    expect(Buffer.from(await plain.arrayBuffer()).equals(original)).toBe(true);
  });

  it('lets a browser keep the hashed files for good, and asks it to check the entry page', async () => {
    if (!clientBuilt()) return;

    const bundle = await get(bundlePath());
    expect(bundle.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    // The CORS plugin's `Vary: *` would make every cached copy unusable.
    expect(bundle.headers.get('vary')).toBe('Accept-Encoding');

    // Nor does a file that is not compressed escape it: an image reused without asking is the point.
    const imagesDirectory = `${clientDistPath()}/assets/assets/images`;
    const image = existsSync(imagesDirectory)
      ? readdirSync(imagesDirectory).find((name) => name.endsWith('.png'))
      : undefined;
    if (image) {
      const png = await get(`/client/assets/assets/images/${image}`);
      expect(png.status).toBe(200);
      expect(png.headers.get('vary')).toBe('Accept-Encoding');
      expect(png.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    }

    const entry = await get('/client/');
    expect(entry.headers.get('cache-control')).toBe('no-cache');
    expect(entry.headers.get('etag')).toBeTruthy();
  });

  it('answers 304 to a browser that comes back with the tag, for the bundle and for the entry page', async () => {
    if (!clientBuilt()) return;
    for (const path of [bundlePath(), '/client/']) {
      const first = await get(path, { 'accept-encoding': 'br' });
      const etag = first.headers.get('etag')!;

      const again = await get(path, { 'accept-encoding': 'br', 'if-none-match': etag });

      expect([path, again.status]).toEqual([path, 304]);
      expect((await again.arrayBuffer()).byteLength).toBe(0);
    }
  });

  it('keeps the isolation headers on every answer, 304 included', async () => {
    if (!clientBuilt()) return;
    const first = await get(bundlePath(), { 'accept-encoding': 'br' });
    const again = await get(bundlePath(), {
      'accept-encoding': 'br',
      'if-none-match': first.headers.get('etag')!,
    });

    for (const response of [first, again]) {
      expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
      expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    }
  });
});
