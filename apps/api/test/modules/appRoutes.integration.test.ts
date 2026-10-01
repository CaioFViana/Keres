import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { clientDistPath, showcaseDistPath } from '../../src/config/resourceRoot';
import { eq } from 'drizzle-orm';
import { env } from '../../src/config/env';
import { db } from '../../src/db';
import { showcaseSettings, tiers, userRecoveryCodes, users } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { userService } from '../../src/services/UserService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;
let ana: TestUser;

const seedTier = async () => {
  const tierId = newId();
  await db.insert(tiers).values({
    id: tierId,
    name: `Tier ${tierId}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
  } as never);
  return tierId;
};

const setShowcaseEnabled = async (enabled: boolean) => {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: enabled } });
};

/** Root-level paths (`/app`, `/showcase`, `/_expo`, ...), which the `/api` helper never sends. */
const rootRequest = async (path: string, headers: Record<string, string> = {}) => {
  const app = await getApp();
  const response = await app.handle(new Request(`http://localhost${path}`, { headers }));
  return { status: response.status, headers: response.headers, text: await response.text() };
};

/**
 * The client bundle name carries a content hash, so the asset test reads it from the export's
 * own index.html instead of pinning a filename that every client rebuild invalidates.
 */
const resolveRuntimeBundlePath = () => {
  const html = readFileSync(`${clientDistPath()}/index.html`, 'utf8');
  const match = html.match(/src="(\/_expo\/[^"]+\.js)"/);
  if (!match) throw new Error('client dist index.html references no _expo bundle');
  return match[1];
};

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
});

afterEach(async () => {
  env.ROOT_ADMIN_USERNAME = undefined;
});

describe('hosted bottleneck routes', () => {
  it('redirects the legacy client path to the origin root', async () => {
    for (const path of ['/app', '/app/StorySelection']) {
      const { status, headers } = await rootRequest(path);
      expect(status).toBe(302);
      expect(headers.get('location')).toBe('/');
    }
  });

  it('serves the public site only while it is enabled', async () => {
    await setShowcaseEnabled(true);

    // The 200 half needs the built site; CI never builds it, so there only the gating half runs.
    if (existsSync(`${showcaseDistPath()}/index.html`)) {
      for (const path of ['/showcase', '/showcase/deep/link']) {
        const { status, headers, text } = await rootRequest(path);
        expect(status).toBe(200);
        expect(headers.get('content-type')).toContain('text/html');
        expect(text).toContain('<html');
        expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      }
    }

    await setShowcaseEnabled(false);
    for (const path of ['/showcase', '/showcase/deep/link']) {
      const { status } = await rootRequest(path);
      expect(status).toBe(404);
    }
  });

  it('serves the public site static files under /_showcase', async () => {
    if (!existsSync(`${showcaseDistPath()}/index.html`)) {
      return;
    }
    await setShowcaseEnabled(true);

    const { status, text } = await rootRequest('/_showcase/index.html');

    expect(status).toBe(200);
    expect(text).toContain('<html');
  });

  it('answers the removed admin API contract with JSON, never the panel', async () => {
    const { status, text } = await rootRequest('/admin/api');

    expect(status).toBe(404);
    expect(JSON.parse(text)).toEqual({ message: 'Not found' });
  });

  it('serves client runtime assets with isolation headers and 404s the missing ones', async () => {
    // The 200 half needs the built client; CI never builds it, so there only the 404 half runs.
    if (existsSync(`${clientDistPath()}/index.html`)) {
      const { status, headers, text } = await rootRequest(resolveRuntimeBundlePath());

      expect(status).toBe(200);
      expect(headers.get('cross-origin-embedder-policy')).toBe('require-corp');
      expect(text.length).toBeGreaterThan(0);
    }

    expect((await rootRequest('/_expo/static/js/web/does-not-exist.js')).status).toBe(404);
    expect((await rootRequest('/assets/does-not-exist.png')).status).toBe(404);
  });

  it('treats a malformed bearer token like no token on public routes', async () => {
    const { status } = await rootRequest('/api/kerescheck', { authorization: 'Bearer not-a-jwt' });

    expect(status).toBe(200);
  });
});

describe('admin user routes', () => {
  it('rejects a user list query the schema refuses', async () => {
    const { status, data } = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { tierId: 'not-a-ulid' },
    });

    expect(status).toBe(400);
    expect(data.message).toBeTruthy();
  });

  it('filters the user list by tier', async () => {
    const tierId = await seedTier();
    const { data: created } = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'bia', password: 'senha-de-teste-123', tierId },
    });

    const { data } = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { tierId },
    });

    expect(data.items.map((item: { id: string }) => item.id)).toEqual([created.id]);
  });

  it('rejects a create whose tier id is malformed, and 404s one whose tier is missing', async () => {
    const malformed = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'bia', password: 'senha-de-teste-123', tierId: 'not-a-ulid' },
    });
    expect(malformed.status).toBe(400);

    const missing = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'bia', password: 'senha-de-teste-123', tierId: newId() },
    });
    expect(missing.status).toBe(404);
  });

  it('rejects an update whose tier id is malformed, and 404s one whose tier is missing', async () => {
    const malformed = await request('PUT', `/admin/api/users/${ana.userId}`, {
      token: admin.token,
      body: { tierId: 'not-a-ulid' },
    });
    expect(malformed.status).toBe(400);

    const missing = await request('PUT', `/admin/api/users/${ana.userId}`, {
      token: admin.token,
      body: { tierId: newId() },
    });
    expect(missing.status).toBe(404);
  });

  it('answers 404 updating, deleting, restoring and reissuing codes for a ghost', async () => {
    const ghost = newId();

    expect(
      (
        await request('PUT', `/admin/api/users/${ghost}`, {
          token: admin.token,
          body: { bio: 'x' },
        })
      ).status,
    ).toBe(404);
    expect(
      (await request('DELETE', `/admin/api/users/${ghost}`, { token: admin.token })).status,
    ).toBe(404);
    expect(
      (await request('POST', `/admin/api/users/${ghost}/restore`, { token: admin.token })).status,
    ).toBe(404);
    expect(
      (
        await request('POST', `/admin/api/users/${ghost}/regenerate-recovery-codes`, {
          token: admin.token,
        })
      ).status,
    ).toBe(404);
  });

  it('refuses to demote or delete the reconciled root account', async () => {
    env.ROOT_ADMIN_USERNAME = 'zelador';
    const { status, data: created } = await request('POST', '/admin/api/users', {
      token: admin.token,
      body: { username: 'zelador', password: 'senha-de-teste-123', isAdmin: true },
    });
    expect(status).toBe(201);

    const demote = await request('PUT', `/admin/api/users/${created.id}`, {
      token: admin.token,
      body: { isAdmin: false },
    });
    expect(demote.status).toBe(409);

    const remove = await request('DELETE', `/admin/api/users/${created.id}`, {
      token: admin.token,
    });
    expect(remove.status).toBe(409);
  });
});

describe('user routes and account service', () => {
  const hardDelete = async (userId: string) => {
    await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  };

  it('fails tag, profile and password writes for an account that is gone', async () => {
    const ghost = await registerUser('fantasma');
    await hardDelete(ghost.userId);

    expect(
      (await request('PUT', '/user/tag', { token: ghost.token, body: { tag: 'nova' } })).status,
    ).toBe(500);
    expect(
      (await request('PUT', '/user/profile', { token: ghost.token, body: { bio: 'x' } })).status,
    ).toBe(500);
    expect(
      (
        await request('PUT', '/user/password', {
          token: ghost.token,
          body: { currentPassword: ghost.password, newPassword: 'nova-senha-123' },
        })
      ).status,
    ).toBe(500);
  });

  it('rejects a profile and a password the schema refuses', async () => {
    const profile = await request('PUT', '/user/profile', {
      token: ana.token,
      body: { bio: 'x'.repeat(201) },
    });
    expect(profile.status).toBe(400);

    const password = await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: ana.password, newPassword: 'curta' },
    });
    expect(password.status).toBe(400);
  });

  it('reissues recovery codes only with the current password', async () => {
    expect(
      (await request('PUT', '/user/recovery-codes', { body: { currentPassword: 'x' } })).status,
    ).toBe(401);
    expect(
      (
        await request('PUT', '/user/recovery-codes', {
          token: ana.token,
          body: { currentPassword: '' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('PUT', '/user/recovery-codes', {
          token: ana.token,
          body: { currentPassword: 'senha-errada' },
        })
      ).status,
    ).toBe(401);

    const { status, data } = await request('PUT', '/user/recovery-codes', {
      token: ana.token,
      body: { currentPassword: ana.password },
    });
    expect(status).toBe(200);
    expect(data.recoveryCodes).toHaveLength(8);

    const ghost = await registerUser('fantasma');
    await hardDelete(ghost.userId);
    expect(
      (
        await request('PUT', '/user/recovery-codes', {
          token: ghost.token,
          body: { currentPassword: ghost.password },
        })
      ).status,
    ).toBe(500);
  });

  it('reports taken when the username - and even the fallback tag - is claimed', async () => {
    expect(
      await userService.createAccount({
        id: newId(),
        username: 'ana',
        hashedPassword: 'x',
        defaultTierId: null,
      }),
    ).toBe('taken');

    // Tag taken ('ALVO'), username free ('alvo'): the first insert fails on the tag index,
    // the suffixed retry ('alvoWXYZ') fails again - both collisions, one 'taken'.
    await db.insert(users).values([
      { id: newId(), username: 'x', tag: 'ALVO', password: 'x' },
      { id: newId(), username: 'y', tag: 'ALVOWXYZ', password: 'x' },
    ] as never);
    expect(
      await userService.createAccount({
        id: `${'0'.repeat(22)}WXYZ`,
        username: 'alvo',
        hashedPassword: 'x',
        defaultTierId: null,
      }),
    ).toBe('taken');
  });
});
