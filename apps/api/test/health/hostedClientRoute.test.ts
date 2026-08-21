import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { clientDistPath } from '../../src/config/resourceRoot';
import { createApp } from '../../src/index';
import { HOSTED_CLIENT_META } from '../../src/services/hostedClient';

describe('GET /', () => {
  it('serves the hosted client HTML with isolation headers when the export exists', async () => {
    if (!existsSync(`${clientDistPath()}/index.html`)) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    const html = await response.text();
    expect(html).toContain(HOSTED_CLIENT_META);
    expect(html).toContain('/_expo/');
  });

  it('redirects the legacy /app path to the origin root', async () => {
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/app', { redirect: 'manual' }));
    expect([301, 302, 307, 308]).toContain(response.status);
    const location = response.headers.get('location') ?? '';
    expect(new URL(location, 'http://localhost').pathname).toBe('/');
  });

  it('sends unknown client paths back to / so F5 does not 404', async () => {
    if (!existsSync(`${clientDistPath()}/index.html`)) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(
      new Request('http://localhost/StorySelection', { redirect: 'manual' }),
    );
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get('location') ?? '', 'http://localhost').pathname).toBe('/');
  });
});
