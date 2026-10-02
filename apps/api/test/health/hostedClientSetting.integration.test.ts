import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { landingDistPath, showcaseDistPath } from '../../src/config/resourceRoot';
import { createApp } from '../../src/index';
import { request, registerUser, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
});

// This file leaves showcase_settings with the hosted client disabled, and the files after it in
// the run do not truncate - without this, a later suite reads a redirect instead of the client
// (hostedClientRoute.test.ts fails on the missing isolation headers).
afterAll(truncateAll);

const landingBuilt = () => existsSync(`${landingDistPath()}/index.html`);
const showcaseBuilt = () => existsSync(`${showcaseDistPath()}/index.html`);

async function rootLocation(): Promise<{ status: number; location: string | null }> {
  const app = await createApp();
  const response = await app.handle(new Request('http://localhost/'));
  return { status: response.status, location: response.headers.get('location') };
}

describe('hosted client setting', () => {
  it('defaults to enabled and sends the root on to the next page when disabled', async () => {
    const initial = await request('GET', '/admin/showcase-settings', { token: admin.token });
    expect(initial.status).toBe(200);
    expect(initial.data.isHostedClientEnabled).toBe(true);
    expect(initial.data.isLandingEnabled).toBe(false);

    const updated = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isHostedClientEnabled: false },
    });
    expect(updated.status).toBe(200);
    expect(updated.data.isHostedClientEnabled).toBe(false);
    expect(updated.data.isShowcaseEnabled).toBe(false);

    // Client off, showcase off: the root falls through to the API docs.
    const docs = await rootLocation();
    expect(docs.status).toBe(302);
    expect(docs.location).toBe('/api/swagger');

    // Showcase on: the root sends people there instead - when its bundle was built. CI never builds it, so
    // there the root still falls through to the API docs: an enabled page with no files is skipped.
    await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isShowcaseEnabled: true },
    });
    const showcase = await rootLocation();
    expect(showcase.status).toBe(302);
    expect(showcase.location).toBe(showcaseBuilt() ? '/showcase' : '/api/swagger');

    // The entry is what the setting switches off; the client's own address answers 404 too.
    const app = await createApp();
    const entry = await app.handle(new Request('http://localhost/client/'));
    expect(entry.status).toBe(404);

    const back = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isHostedClientEnabled: true },
    });
    expect(back.data.isHostedClientEnabled).toBe(true);
  });

  it('serves the landing page at the root when enabled and built', async () => {
    // The 200 half needs the landing build; CI never builds it, so there only the fall-through
    // half runs.
    await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isLandingEnabled: true },
    });

    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/'));
    if (!landingBuilt()) {
      // Enabled but never built: the root falls through to the next page, not a 404.
      expect(response.status).toBe(302);
      return;
    }

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const html = await response.text();
    expect(html).toContain('<div id="root"></div>');
    // The bundle was made for its prefix: every URL in it already carries it.
    expect(html).toContain('/_landing/');
    expect(html).not.toMatch(/(?:src|href)="\/assets\//);
  });

  it('serves the landing static files under /_landing', async () => {
    if (!landingBuilt()) {
      return;
    }
    await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isLandingEnabled: true },
    });

    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/_landing/index.html'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(await response.text()).toContain('<html');
  });
});
