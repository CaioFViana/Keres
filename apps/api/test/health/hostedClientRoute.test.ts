import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
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
