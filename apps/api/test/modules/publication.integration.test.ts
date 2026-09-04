import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings, storyPublications } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

/**
 * The .zip files stored for a story, straight from the local blob backend's disk.
 *
 * A package with no matching row is invisible to the API, so only by looking at storage can we assert
 * that a refused publication left no litter behind.
 */
async function storedPublicationFiles(storyId: string): Promise<string[]> {
  const directory = path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId);
  try {
    return (await readdir(directory)).sort();
  } catch {
    return [];
  }
}

let ana: TestUser;

async function enableShowcase(enabled = true): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: { isShowcaseEnabled: enabled },
    });
}

async function createStory(token: string, title = 'A Queda') {
  return uploadTestStory(token, title);
}

/** The server refuses to publish out of sync, so the test needs the real counter. */
async function serverOperationVersion(storyId: string): Promise<number> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return story!.lastOperationVersion;
}

async function publish(token: string, storyId: string, labelMode = 'both') {
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: await serverOperationVersion(storyId), labelMode },
  });
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('POST /stories/:storyId/publications', () => {
  it('publishes a version the owner can then list', async () => {
    const story = await createStory(ana.token);

    const { status, data } = await publish(ana.token, story.id);
    expect(status).toBe(200);
    expect(data.storyId).toBe(story.id);
    expect(data.ownerUserId).toBe(ana.userId);
    expect(data.label).toMatch(/^v\d+-\d{4}-\d{2}-\d{2}$/);
    expect(data.byteSize).toBeGreaterThan(0);

    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.status).toBe(200);
    expect(listed.data.isPublished).toBe(true);
    expect(listed.data.visibility).toBe('public');
    expect(listed.data.publications).toHaveLength(1);
  });

  it('honours the label style the owner asked for', async () => {
    const story = await createStory(ana.token);

    const versionOnly = await publish(ana.token, story.id, 'version');
    expect(versionOnly.data.label).toMatch(/^v\d+$/);
  });

  it('rejects a publish when the client is behind the server', async () => {
    const story = await createStory(ana.token);

    const { status, data } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      // A counter ahead of the server's: it is what the app would see with a pending local operation.
      body: { operationVersion: (await serverOperationVersion(story.id)) + 1 },
    });

    expect(status).toBe(409);
    expect(data.message).toMatch(/not in sync/i);
  });

  it('refuses a non-owner, even one with write permission', async () => {
    const bia = await registerUser('bia');
    const story = await createStory(ana.token);

    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
    await request('POST', '/story-permissions', {
      token: ana.token,
      body: { storyId: story.id, targetUserId: bia.userId, permissionType: 'writer' },
    });

    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      token: bia.token,
      body: { operationVersion: await serverOperationVersion(story.id) },
    });

    expect(status).toBe(403);
  });

  it('requires a session', async () => {
    const story = await createStory(ana.token);
    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      body: { operationVersion: 1 },
    });
    expect(status).toBe(401);
  });

  it('refuses to publish while the showcase is disabled', async () => {
    const story = await createStory(ana.token);
    await enableShowcase(false);

    const { status } = await publish(ana.token, story.id);
    expect(status).toBe(403);
  });

  it('keeps only the newest five versions', async () => {
    const story = await createStory(ana.token);

    for (let index = 0; index < 6; index++) {
      const published = await publish(ana.token, story.id, 'date');
      expect(published.status).toBe(200);
    }

    const rows = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, story.id));
    expect(rows).toHaveLength(5);
    // The day's first one carries no suffix; the sixth pushed exactly that one out.
    expect(rows.map((row) => row.label)).not.toContain(
      rows
        .map((row) => row.label)
        .sort()[0]
        .replace(/-\d{2}$/, ''),
    );
  });
});

describe('GET /stories/publications/mine', () => {
  it('includes publications of stories shared with the user', async () => {
    const bia = await registerUser('bia');
    const story = await createStory(ana.token);

    await request('POST', `/friend/request/${bia.userId}`, { token: ana.token });
    await request('PUT', `/friend/accept/${ana.userId}`, { token: bia.token });
    await request('POST', '/story-permissions', {
      token: ana.token,
      body: { storyId: story.id, targetUserId: bia.userId, permissionType: 'reader' },
    });
    await publish(ana.token, story.id);

    const { status, data } = await request('GET', '/stories/publications/mine', {
      token: bia.token,
    });
    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].storyId).toBe(story.id);
  });

  it('does not leak publications of stories the user cannot read', async () => {
    const bia = await registerUser('bia');
    const story = await createStory(ana.token);
    await publish(ana.token, story.id);

    const { data } = await request('GET', '/stories/publications/mine', { token: bia.token });
    expect(data).toEqual([]);
  });
});

describe('DELETE /stories/:storyId/publications', () => {
  it('deletes a single version and keeps the story listed', async () => {
    const story = await createStory(ana.token);
    const first = await publish(ana.token, story.id, 'date');
    const second = await publish(ana.token, story.id, 'date');

    const { status } = await request(
      'DELETE',
      `/stories/${story.id}/publications/${first.data.id}`,
      { token: ana.token },
    );
    expect(status).toBe(200);

    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.data.isPublished).toBe(true);
    expect(listed.data.publications.map((row: { id: string }) => row.id)).toEqual([second.data.id]);
  });

  it('unlists the story when its last version is deleted', async () => {
    const story = await createStory(ana.token);
    const only = await publish(ana.token, story.id);

    await request('DELETE', `/stories/${story.id}/publications/${only.data.id}`, {
      token: ana.token,
    });

    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.data.isPublished).toBe(false);
    expect(listed.data.publications).toEqual([]);
  });

  it('unpublishes the whole story', async () => {
    const story = await createStory(ana.token);
    await publish(ana.token, story.id, 'date');
    await publish(ana.token, story.id, 'date');

    const { status } = await request('DELETE', `/stories/${story.id}/publications`, {
      token: ana.token,
    });
    expect(status).toBe(200);

    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.data.isPublished).toBe(false);
    expect(listed.data.publications).toEqual([]);
  });

  it('refuses a non-owner', async () => {
    const bia = await registerUser('bia');
    const story = await createStory(ana.token);
    await publish(ana.token, story.id);

    const { status } = await request('DELETE', `/stories/${story.id}/publications`, {
      token: bia.token,
    });
    expect(status).toBe(403);
  });
});

describe('PUT /stories/:storyId/showcase', () => {
  it('switches a published story to password visibility', async () => {
    const story = await createStory(ana.token);
    await publish(ana.token, story.id);

    const { status, data } = await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    expect(status).toBe(200);
    expect(data.visibility).toBe('password');
    expect(data.hasPassword).toBe(true);
    // Nem a senha nem o hash dela voltam - nem para o dono.
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('clears the stored hash when going back to public', async () => {
    const story = await createStory(ana.token);
    await publish(ana.token, story.id);
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    const { data } = await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'public' },
    });
    expect(data.visibility).toBe('public');
    expect(data.hasPassword).toBe(false);
  });

  it('rejects password visibility with no password', async () => {
    const story = await createStory(ana.token);
    await publish(ana.token, story.id);

    const { status } = await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password' },
    });
    expect(status).toBe(400);
  });

  it('refuses on a story that was never published', async () => {
    const story = await createStory(ana.token);

    const { status } = await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'public' },
    });
    expect(status).toBe(404);
  });
});

describe('publishing and visibility together', () => {
  // The regression that motivated this: visibility was only written by a separate call, so publishing
  // with the padlock off did not undo a password set earlier - the action looked like it had no effect
  // at all.
  it('publishing without a password makes a password-protected story public again', async () => {
    const story = await createStory(ana.token);
    await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: {
        operationVersion: await serverOperationVersion(story.id),
        labelMode: 'date',
        visibility: 'password',
        password: 'hunter2',
      },
    });

    const locked = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(locked.data.visibility).toBe('password');
    expect(locked.data.hasPassword).toBe(true);

    await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: { operationVersion: await serverOperationVersion(story.id), labelMode: 'date' },
    });

    const opened = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(opened.data.visibility).toBe('public');
    expect(opened.data.hasPassword).toBe(false);
    // Both versions stay published: changing visibility erases nothing.
    expect(opened.data.publications).toHaveLength(2);
  });

  it('publishes straight into password visibility without a second call', async () => {
    const story = await createStory(ana.token);
    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: {
        operationVersion: await serverOperationVersion(story.id),
        visibility: 'password',
        password: 'hunter2',
      },
    });

    expect(status).toBe(200);
    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.data.visibility).toBe('password');
  });

  it('refuses to publish as password-protected with no password', async () => {
    const story = await createStory(ana.token);
    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: { operationVersion: await serverOperationVersion(story.id), visibility: 'password' },
    });

    expect(status).toBe(400);
  });

  it('stores exactly one package per accepted publication', async () => {
    const story = await createStory(ana.token);
    await publish(ana.token, story.id, 'date');
    await publish(ana.token, story.id, 'date');

    const rows = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, story.id));
    expect(await storedPublicationFiles(story.id)).toHaveLength(rows.length);
  });

  // These refusals happen before the package is assembled, so what is guaranteed here is that none of
  // them writes a file. A failure *inside* the transaction (a database error), which is the case
  // `runPublishTransaction` cleans up, is not reachable over HTTP.
  it.each([
    ['out of sync', { offset: 1 }],
    ['password-protected with no password', { visibility: 'password' as const }],
  ])('writes no package when the publication is rejected as %s', async (_case, overrides) => {
    const story = await createStory(ana.token);
    const before = await storedPublicationFiles(story.id);

    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: {
        operationVersion:
          (await serverOperationVersion(story.id)) + ('offset' in overrides ? 1 : 0),
        ...('visibility' in overrides ? { visibility: overrides.visibility } : {}),
      },
    });

    expect(status).toBeGreaterThanOrEqual(400);
    expect(await storedPublicationFiles(story.id)).toEqual(before);
  });
});
