import { beforeEach, describe, expect, it } from 'vitest';
import { showcaseLogoStorageService } from '../../src/services/ShowcaseLogoStorageService';
import { registerUser, request, type TestUser } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { promoteToAdmin, truncateAll } from '../helpers/database';

// Logo bytes go through the local blob backend, which uses `Bun.write`/`Bun.file`.
installBunShim();

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let admin: TestUser;

async function uploadLogo(bytes = PNG_BYTES, type = 'image/png') {
  const form = new FormData();
  form.append('logo', new File([Buffer.from(bytes)], 'logo.png', { type }));
  return request('POST', '/admin/showcase-settings/logo', { token: admin.token, body: form });
}

async function setShowcase(enabled: boolean, extra: Record<string, unknown> = {}) {
  return request('PUT', '/admin/showcase-settings', {
    token: admin.token,
    body: { isShowcaseEnabled: enabled, ...extra },
  });
}

beforeEach(async () => {
  await truncateAll();
  // The blob directory survives `truncateAll`; a logo left by an earlier test would leak into this one.
  await showcaseLogoStorageService.delete();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
});

describe('GET /public/config branding', () => {
  it('returns the defaults with no logo while disabled', async () => {
    const { status, data } = await request('GET', '/public/config');

    expect(status).toBe(200);
    expect(data).toMatchObject({
      showcaseEnabled: false,
      siteName: 'Keres',
      sitePalette: 'default',
      logoUrl: null,
    });
    expect(data.serverVersion).toBeTruthy();
  });

  it('reflects the branding and the logo URL once configured', async () => {
    await setShowcase(true, { siteName: 'Acme Press', sitePalette: 'ocean' });
    const uploaded = await uploadLogo();
    const epochMs = new Date(uploaded.data.logoUpdatedAt).getTime();

    const { data } = await request('GET', '/public/config');

    expect(data).toMatchObject({
      showcaseEnabled: true,
      siteName: 'Acme Press',
      sitePalette: 'ocean',
      logoUrl: `/api/public/showcase-logo?v=${epochMs}`,
    });
  });

  it('drops the logo URL once the logo is removed', async () => {
    await setShowcase(true);
    await uploadLogo();
    await request('DELETE', '/admin/showcase-settings/logo', { token: admin.token });

    const { data } = await request('GET', '/public/config');

    expect(data.logoUrl).toBeNull();
  });
});

describe('GET /public/showcase-logo', () => {
  it('serves the bytes with content type, ETag and an hour of caching', async () => {
    await setShowcase(true);
    await uploadLogo();

    const { status, headers } = await request('GET', '/public/showcase-logo');

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('image/png');
    expect(headers.get('etag')).toMatch(/^W\/"showcase-logo-\d+"$/);
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('answers 304 to a matching If-None-Match', async () => {
    await setShowcase(true);
    await uploadLogo();

    const first = await request('GET', '/public/showcase-logo');
    const second = await request('GET', '/public/showcase-logo', {
      headers: { 'if-none-match': first.headers.get('etag')! },
    });

    expect(second.status).toBe(304);
  });

  it('404s when no logo was uploaded', async () => {
    await setShowcase(true);

    const { status } = await request('GET', '/public/showcase-logo');

    expect(status).toBe(404);
  });

  it('404s while the showcase is disabled', async () => {
    await setShowcase(true);
    await uploadLogo();
    await setShowcase(false);

    const { status } = await request('GET', '/public/showcase-logo');

    expect(status).toBe(404);
  });
});
