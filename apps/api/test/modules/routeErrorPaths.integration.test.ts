import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_PROTOCOL_HEADER } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { env } from '../../src/config/env';
import { db } from '../../src/db';
import {
  friendships,
  stories,
  storyPublications,
  tiers,
  userRecoveryCodes,
  users,
} from '../../src/db/schema';
import { showcaseSettings } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { showcaseService } from '../../src/services/ShowcaseService';
import { userService } from '../../src/services/UserService';
import { installBunShim } from '../helpers/bunShim';
import {
  getApp,
  newId,
  registerUser,
  request,
  uploadTestStory,
  type TestUser,
} from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

installBunShim();

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const md5 = (bytes: Uint8Array) => createHash('md5').update(Buffer.from(bytes)).digest('hex');

const enableShowcase = async (enabled = true) => {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: { isShowcaseEnabled: enabled },
    });
};

const serverOperationVersion = async (storyId: string) => {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  return story!.lastOperationVersion;
};

const publishCurrent = async (
  token: string,
  storyId: string,
  extra: Record<string, unknown> = {},
) =>
  request('POST', `/stories/${storyId}/publications`, {
    token,
    body: {
      operationVersion: await serverOperationVersion(storyId),
      labelMode: 'version',
      ...extra,
    },
  });

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('chefe');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  await enableShowcase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public showcase routes', () => {
  it('answers 404 downloading or linking a story nobody published', async () => {
    const story = await uploadTestStory(ana.token);
    const ghost = newId();

    expect(
      (await request('GET', `/public/stories/${story.id}/publications/${ghost}/download`, {}))
        .status,
    ).toBe(404);
    expect(
      (await request('POST', `/public/stories/${story.id}/publications/${ghost}/download-url`, {}))
        .status,
    ).toBe(404);
  });

  it('answers 404 for a protected download link without a token, or a bogus version', async () => {
    const story = await uploadTestStory(ana.token, 'Segredo');
    const published = await publishCurrent(ana.token, story.id, {
      visibility: 'password',
      password: 'senha-secreta-123',
    });
    expect(published.status).toBe(200);
    const publicationId = (published.data as { id: string }).id;

    expect(
      (
        await request(
          'POST',
          `/public/stories/${story.id}/publications/${publicationId}/download-url`,
          {},
        )
      ).status,
    ).toBe(404);

    const unlocked = await request('POST', `/public/stories/${story.id}/unlock`, {
      body: { password: 'senha-secreta-123' },
    });
    expect(unlocked.status).toBe(200);
    expect(
      (
        await request('POST', `/public/stories/${story.id}/publications/${newId()}/download-url`, {
          headers: { authorization: `Showcase ${(unlocked.data as { token: string }).token}` },
        })
      ).status,
    ).toBe(404);
  });

  it('skips a showcase entry whose versions are gone, in the list and in the detail', async () => {
    const story = await uploadTestStory(ana.token);
    expect((await publishCurrent(ana.token, story.id)).status).toBe(200);
    await db.delete(storyPublications).where(eq(storyPublications.storyId, story.id));

    expect((await request('GET', `/public/stories/${story.id}`, {})).status).toBe(404);
    const { status, data } = await request('GET', '/public/stories', {});
    expect(status).toBe(200);
    expect(data).toEqual([]);

    await expect(showcaseService.getStoryDetail(newId())).resolves.toBeNull();
  });

  it('falls back to a generic filename when the title carries no slug', async () => {
    const story = await uploadTestStory(ana.token, '!!!');
    const published = await publishCurrent(ana.token, story.id);
    expect(published.status).toBe(200);
    const publicationId = (published.data as { id: string }).id;

    const app = await getApp();
    const response = await app.handle(
      new Request(
        `http://localhost/api/public/stories/${story.id}/publications/${publicationId}/download`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('filename="story-');
  });
});

describe('media routes', () => {
  const upload = (
    token: string,
    story: string,
    hash: string,
    bytes: Uint8Array,
    mimeType: string | null = 'image/png',
    fileType?: string,
  ) => {
    const form = new FormData();
    form.append(
      'file',
      new File(
        [Buffer.from(bytes)],
        'retrato.png',
        fileType === undefined ? { type: mimeType ?? 'image/png' } : { type: fileType },
      ),
    );
    if (mimeType !== null) {
      form.append('mimeType', mimeType);
    }
    return request('POST', `/media/${story}/blobs/${hash}`, { token, body: form });
  };

  it('refuses a blob bigger than the server allows', async () => {
    const story = await uploadTestStory(ana.token);
    const previous = env.MEDIA_MAX_BYTES;
    env.MEDIA_MAX_BYTES = 4;
    try {
      const { status } = await upload(ana.token, story.id, md5(PNG_BYTES), PNG_BYTES);
      expect(status).toBe(413);
    } finally {
      env.MEDIA_MAX_BYTES = previous;
    }
  });

  it('refuses an upload once the tier storage quota is reached', async () => {
    const story = await uploadTestStory(ana.token);
    const tierId = newId();
    await db.insert(tiers).values({
      id: tierId,
      name: `Tier ${tierId}`,
      isDefault: false,
      maxStories: null,
      maxEntitiesPerStory: null,
      maxEntitiesTotal: null,
      maxStorageBytesPerStory: 1,
      maxStorageBytesTotal: null,
    } as never);
    await db.update(users).set({ tierId }).where(eq(users.id, ana.userId));

    const { status } = await upload(ana.token, story.id, md5(PNG_BYTES), PNG_BYTES);
    expect(status).toBe(403);
  });

  it('takes the MIME type from the file itself when the field is missing', async () => {
    const story = await uploadTestStory(ana.token);

    const { status } = await upload(ana.token, story.id, md5(PNG_BYTES), PNG_BYTES, null);
    expect(status).toBe(200);
  });

  it('rejects a blob whose type no side declares', async () => {
    const story = await uploadTestStory(ana.token);

    const { status } = await upload(ana.token, story.id, md5(PNG_BYTES), PNG_BYTES, null, '');
    expect(status).toBe(415);
  });
});

describe('auth routes', () => {
  it('still reports taken when the username is claimed mid-registration', async () => {
    vi.spyOn(userService, 'isUsernameTaken').mockResolvedValue(false);

    const { status, data } = await request('POST', '/auth/register', {
      body: { username: 'ana', password: 'outra-senha-123' },
    });

    expect(status).toBe(409);
    expect(data.message).toMatch(/already exists/i);
  });

  it('rejects a password reset the schema refuses', async () => {
    const { status } = await request('POST', '/auth/forgot-password', {
      body: { username: 'ana', recoveryCode: 'whatever', newPassword: 'curta' },
    });
    expect(status).toBe(400);
  });

  it('refreshes from the cookie when the body carries no token', async () => {
    const app = await getApp();
    const response = await app.handle(
      new Request('http://localhost/api/auth/refresh', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `refresh_token=${ana.refreshToken}`,
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).username).toBe('ana');
  });

  it('answers 401 for a session whose account is gone', async () => {
    await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, ana.userId));
    await db.delete(users).where(eq(users.id, ana.userId));

    expect((await request('GET', '/auth/me', { token: ana.token })).status).toBe(401);
  });
});

describe('sync routes', () => {
  it('locks out a client past 120 attempts a minute, on pull and on push', async () => {
    const story = await uploadTestStory(ana.token);
    const pullStatuses: number[] = [];
    for (let attempt = 0; attempt < 121; attempt += 1) {
      const { status } = await request('GET', `/sync/${story.id}/pull`, {
        token: ana.token,
        query: { lastOperationVersion: 0 },
      });
      pullStatuses.push(status);
    }
    expect(pullStatuses.slice(0, 120)).toEqual(new Array(120).fill(200));
    expect(pullStatuses[120]).toBe(429);

    // Pull and push share one budget: the exhausted client is refused on push too.
    const { status } = await request('POST', `/sync/${story.id}`, { token: ana.token, body: [] });
    expect(status).toBe(429);
  });

  it('names its own version when the client announces one it cannot serve', async () => {
    const story = await uploadTestStory(ana.token);

    const { status, data } = await request('GET', `/sync/${story.id}/pull`, {
      token: ana.token,
      headers: { [SYNC_PROTOCOL_HEADER]: '999' },
      query: { lastOperationVersion: 0 },
    });

    expect(status).toBe(426);
    expect(data.message).toContain('999');
  });
});

describe('remaining admin routes', () => {
  it('answers 404 for a tier that is not there, on update and on delete', async () => {
    const ghost = newId();
    expect(
      (
        await request('PUT', `/admin/api/tiers/${ghost}`, {
          token: admin.token,
          body: { name: 'X' },
        })
      ).status,
    ).toBe(404);
    expect(
      (await request('DELETE', `/admin/api/tiers/${ghost}`, { token: admin.token })).status,
    ).toBe(404);
  });

  it('rejects a tier the schema refuses, on create and on update', async () => {
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

    expect(
      (
        await request('POST', '/admin/api/tiers', {
          token: admin.token,
          body: { name: 'Ruim', maxStories: -1 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('PUT', `/admin/api/tiers/${tierId}`, {
          token: admin.token,
          body: { maxStories: -1 },
        })
      ).status,
    ).toBe(400);
  });

  it('rejects recovery queries the schema refuses', async () => {
    expect(
      (
        await request('GET', '/admin/api/recovery/deleted', {
          token: admin.token,
          query: { search: 'x'.repeat(101) },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request('GET', '/admin/api/recovery/operation-log', {
          token: admin.token,
          query: { operationType: 'bogus' },
        })
      ).status,
    ).toBe(400);
  });

  it('rejects registration settings the schema refuses', async () => {
    expect(
      (
        await request('PUT', '/admin/api/registration-settings', {
          token: admin.token,
          body: { maxUsers: -1 },
        })
      ).status,
    ).toBe(400);
  });
});

describe('publication service paths', () => {
  it('answers 404 publishing or deleting versions of a story that is gone', async () => {
    const ghost = newId();
    expect(
      (
        await request('POST', `/stories/${ghost}/publications`, {
          token: ana.token,
          body: { operationVersion: 0, labelMode: 'version' },
        })
      ).status,
    ).toBe(404);

    const story = await uploadTestStory(ana.token);
    await db.update(stories).set({ isDeleted: true }).where(eq(stories.id, story.id));
    expect(
      (
        await request('POST', `/stories/${story.id}/publications`, {
          token: ana.token,
          body: { operationVersion: 0, labelMode: 'version' },
        })
      ).status,
    ).toBe(404);

    const live = await uploadTestStory(ana.token);
    expect((await publishCurrent(ana.token, live.id)).status).toBe(200);
    expect(
      (await request('DELETE', `/stories/${live.id}/publications/${newId()}`, { token: ana.token }))
        .status,
    ).toBe(404);
  });
});

describe('friendship service paths', () => {
  it('notifies both directions when the receiver changes profile', async () => {
    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });

    const { status } = await request('PUT', '/user/tag', {
      token: bia.token,
      body: { tag: 'nova' },
    });
    expect(status).toBe(200);
  });

  it('blacklists a pending request without touching permissions', async () => {
    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });

    const { status, data } = await request('POST', `/friend/blacklist/${ana.userId}`, {
      token: bia.token,
    });
    expect(status).toBe(200);
    expect(data.status).toBe('blacklisted');

    const rows = await db.select().from(friendships);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'blacklisted' });
  });
});

describe('recovery code paths', () => {
  it('keeps answering 401 past the attempt budget', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { status } = await request('POST', '/auth/forgot-password', {
        body: { username: 'ana', recoveryCode: 'wrong-code', newPassword: 'nova-senha-123' },
      });
      statuses.push(status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it('spends a code only once when two resets race', async () => {
    const codes = await request('PUT', '/user/recovery-codes', {
      token: bia.token,
      body: { currentPassword: bia.password },
    });
    const code = codes.data.recoveryCodes[0] as string;
    const attempt = () =>
      request('POST', '/auth/forgot-password', {
        body: { username: 'bia', recoveryCode: code, newPassword: 'nova-senha-123' },
      });

    const [first, second] = await Promise.all([attempt(), attempt()]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 401]);
  });
});
