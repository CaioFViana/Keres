import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings, storyPublications } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { registerUser, request, type TestUser } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// O empacotamento da publicação grava o .zip pelo backend local de blobs, que usa `Bun.write`.
installBunShim();

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
  const { data } = await request('POST', '/stories/', {
    token,
    body: { title, type: 'linear' },
  });
  return data;
}

/** O servidor recusa publicar fora de sincronia, então o teste precisa do contador real. */
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
      // Um contador à frente do servidor: é o que o app veria com operação local pendente.
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
    // A primeira do dia não leva sufixo; a sexta empurrou justamente essa para fora.
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
