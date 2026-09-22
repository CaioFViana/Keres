import { beforeEach, describe, expect, it } from 'vitest';
import { showcaseLogoStorageService } from '../../src/services/ShowcaseLogoStorageService';
import { registerUser, request, type TestUser } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { promoteToAdmin, truncateAll } from '../helpers/database';

// Logo bytes go through the local blob backend, which uses `Bun.write`/`Bun.file`.
installBunShim();

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let admin: TestUser;
let ana: TestUser;

function uploadLogo(token: string | undefined, bytes: Uint8Array, type: string, name = 'logo.png') {
  const form = new FormData();
  form.append('logo', new File([Buffer.from(bytes)], name, { type }));
  return request(
    'POST',
    '/admin/showcase-settings/logo',
    token ? { token, body: form } : { body: form },
  );
}

beforeEach(async () => {
  await truncateAll();
  // The blob directory survives `truncateAll`; a logo left by an earlier test would leak into this one.
  await showcaseLogoStorageService.delete();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
});

describe('GET /admin/showcase-settings', () => {
  it('returns the branding defaults and no logo', async () => {
    const { status, data } = await request('GET', '/admin/showcase-settings', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({
      id: 'singleton',
      isShowcaseEnabled: false,
      isHostedClientEnabled: true,
      siteName: 'Keres',
      sitePalette: 'default',
      logoContentType: null,
      logoUpdatedAt: null,
    });
    expect(data.updatedAt).toBeTruthy();
  });

  it('requires an admin session', async () => {
    const anonymous = await request('GET', '/admin/showcase-settings');
    expect(anonymous.status).toBe(401);

    const nonAdmin = await request('GET', '/admin/showcase-settings', { token: ana.token });
    expect(nonAdmin.status).toBe(403);
  });
});

describe('PUT /admin/showcase-settings', () => {
  it('updates the branding and returns the settings', async () => {
    const { status, data } = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { siteName: 'Acme Press', sitePalette: 'ocean' },
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ siteName: 'Acme Press', sitePalette: 'ocean' });
  });

  it('trims the site name', async () => {
    const { data } = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { siteName: '  Acme  ' },
    });

    expect(data.siteName).toBe('Acme');
  });

  it('rejects an unknown palette with 400', async () => {
    const { status } = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { sitePalette: 'neon-lime' },
    });

    expect(status).toBe(400);
  });

  it.each(['', '   ', 'x'.repeat(61)])('rejects site name %j with 400', async (siteName) => {
    const { status } = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { siteName },
    });

    expect(status).toBe(400);
  });

  it('still toggles the switches alongside the branding', async () => {
    const { data } = await request('PUT', '/admin/showcase-settings', {
      token: admin.token,
      body: { isShowcaseEnabled: true, siteName: 'Acme' },
    });

    expect(data).toMatchObject({ isShowcaseEnabled: true, siteName: 'Acme' });
  });

  it('requires an admin session', async () => {
    const anonymous = await request('PUT', '/admin/showcase-settings', {
      body: { siteName: 'Acme' },
    });
    expect(anonymous.status).toBe(401);

    const nonAdmin = await request('PUT', '/admin/showcase-settings', {
      token: ana.token,
      body: { siteName: 'Acme' },
    });
    expect(nonAdmin.status).toBe(403);
  });
});

describe('POST /admin/showcase-settings/logo', () => {
  it('stores the logo and returns the updated settings', async () => {
    const { status, data } = await uploadLogo(admin.token, PNG_BYTES, 'image/png');

    expect(status).toBe(200);
    expect(data.logoContentType).toBe('image/png');
    expect(data.logoUpdatedAt).toBeTruthy();

    const stored = await showcaseLogoStorageService.read();
    expect(stored).toBeTruthy();
  });

  it('replaces the previous logo', async () => {
    await uploadLogo(admin.token, PNG_BYTES, 'image/png');

    const { data } = await uploadLogo(
      admin.token,
      new Uint8Array([0xff, 0xd8]),
      'image/jpeg',
      'logo.jpg',
    );

    expect(data.logoContentType).toBe('image/jpeg');
  });

  it('rejects an unsupported type with 415 and keeps the settings untouched', async () => {
    const { status } = await uploadLogo(admin.token, PNG_BYTES, 'image/svg+xml', 'logo.svg');
    expect(status).toBe(415);

    const { data } = await request('GET', '/admin/showcase-settings', { token: admin.token });
    expect(data.logoContentType).toBeNull();
  });

  it('rejects an oversized logo with 413', async () => {
    const { status } = await uploadLogo(admin.token, new Uint8Array(512 * 1024 + 1), 'image/png');
    expect(status).toBe(413);
  });

  it('requires an admin session', async () => {
    const anonymous = await uploadLogo(undefined, PNG_BYTES, 'image/png');
    expect(anonymous.status).toBe(401);

    const nonAdmin = await uploadLogo(ana.token, PNG_BYTES, 'image/png');
    expect(nonAdmin.status).toBe(403);
  });
});

describe('DELETE /admin/showcase-settings/logo', () => {
  it('removes the logo bytes and clears the settings', async () => {
    await uploadLogo(admin.token, PNG_BYTES, 'image/png');

    const { status, data } = await request('DELETE', '/admin/showcase-settings/logo', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data.logoContentType).toBeNull();
    expect(data.logoUpdatedAt).toBeNull();
    await expect(showcaseLogoStorageService.read()).resolves.toBeNull();
  });

  it('answers 200 when there is no logo to remove', async () => {
    const { status, data } = await request('DELETE', '/admin/showcase-settings/logo', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data.logoContentType).toBeNull();
  });

  it('requires an admin session', async () => {
    const anonymous = await request('DELETE', '/admin/showcase-settings/logo');
    expect(anonymous.status).toBe(401);

    const nonAdmin = await request('DELETE', '/admin/showcase-settings/logo', { token: ana.token });
    expect(nonAdmin.status).toBe(403);
  });
});
