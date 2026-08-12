import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;

async function createStory(token: string, title = 'A Queda', type = 'linear') {
  const { status, data } = await request('POST', '/stories/', { token, body: { title, type } });
  if (status !== 200) {
    throw new Error(`Falha ao criar história (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
});

describe('POST /stories/', () => {
  it('creates a story owned by the authenticated user', async () => {
    const { status, data } = await request('POST', '/stories/', {
      token: ana.token,
      body: { title: 'A Queda', type: 'linear' },
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ title: 'A Queda', type: 'linear', userId: ana.userId, isDeleted: false });
    expect(data.id).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('ignores any owner the client tries to claim', async () => {
    const bia = await registerUser('bia');

    const { data } = await request('POST', '/stories/', {
      token: ana.token,
      body: { title: 'A Queda', type: 'linear', userId: bia.userId },
    });

    expect(data.userId).toBe(ana.userId);
  });

  it('rejects a story type that does not exist', async () => {
    const { status } = await request('POST', '/stories/', {
      token: ana.token,
      body: { title: 'A Queda', type: 'circular' },
    });

    expect(status).toBe(422);
  });

  it('rejects a body with no title', async () => {
    const { status } = await request('POST', '/stories/', { token: ana.token, body: { type: 'linear' } });

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', '/stories/', { body: { title: 'A Queda', type: 'linear' } });

    expect(status).toBe(401);
  });
});

describe('GET /stories/:storyId/export', () => {
  it('exports the story with every collection the format requires', async () => {
    const story = await createStory(ana.token);

    const { status, data } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });

    expect(status).toBe(200);
    expect(data.story).toMatchObject({ id: story.id, title: 'A Queda' });
    for (const collection of ['chapters', 'scenes', 'characters', 'locations', 'tags', 'notes']) {
      expect(Array.isArray(data[collection])).toBe(true);
    }
    expect(typeof data.serverLastOperationVersion).toBe('number');
  });

  it('hides another user’s story behind a 404 instead of admitting it exists', async () => {
    const story = await createStory(ana.token);
    const bia = await registerUser('bia');

    const { status } = await request('GET', `/stories/${story.id}/export`, { token: bia.token });

    expect(status).toBe(404);
  });

  it('answers 404 for a story that never existed', async () => {
    const { status } = await request('GET', `/stories/${newId()}/export`, { token: ana.token });

    expect(status).toBe(404);
  });

  it('requires a session', async () => {
    const story = await createStory(ana.token);

    const { status } = await request('GET', `/stories/${story.id}/export`);

    expect(status).toBe(401);
  });
});

describe('POST /stories/import', () => {
  it('imports an exported story back as a new one', async () => {
    const story = await createStory(ana.token, 'Original');
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });

    const { status, data } = await request('POST', '/stories/import', { token: ana.token, body: exported });

    expect(status).toBe(200);
    expect(data.storyId).toMatch(/^[0-9A-Z]{26}$/);
    expect(data.storyId).not.toBe(story.id);
  });

  it('produces a story whose content matches the one it came from', async () => {
    const story = await createStory(ana.token, 'Original');
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });

    const { data } = await request('POST', '/stories/import', { token: ana.token, body: exported });
    const { data: reExported } = await request('GET', `/stories/${data.storyId}/export`, { token: ana.token });

    expect(reExported.story).toMatchObject({ title: 'Original', type: 'linear', userId: ana.userId });
    expect(reExported.chapters).toEqual(exported.chapters);
  });

  it('makes the importing user the owner, whatever the package says', async () => {
    const story = await createStory(ana.token);
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });
    const bia = await registerUser('bia');

    const { data } = await request('POST', '/stories/import', { token: bia.token, body: exported });
    const { data: reExported } = await request('GET', `/stories/${data.storyId}/export`, { token: bia.token });

    expect(reExported.story.userId).toBe(bia.userId);
  });

  /**
   * O caminho que o cliente usa ao subir pela primeira vez uma história que só existia no
   * aparelho: o id local precisa sobreviver, senão os dois lados passam a chamar a mesma
   * história por nomes diferentes.
   */
  it('keeps the id the client asks to preserve', async () => {
    const story = await createStory(ana.token);
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });
    const localId = newId();
    const localPackage = { ...exported, story: { ...exported.story, id: localId } };
    const bia = await registerUser('bia');

    const { status, data } = await request('POST', '/stories/import', {
      token: bia.token,
      body: localPackage,
      query: { storyId: localId },
    });

    expect(status).toBe(200);
    expect(data.storyId).toBe(localId);
  });

  it('refuses to preserve an id the same user already has', async () => {
    const story = await createStory(ana.token);
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });

    const { status } = await request('POST', '/stories/import', {
      token: ana.token,
      body: exported,
      query: { storyId: story.id },
    });

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('rejects a package that is not a story export', async () => {
    const { status } = await request('POST', '/stories/import', { token: ana.token, body: { hello: 'world' } });

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const story = await createStory(ana.token);
    const { data: exported } = await request('GET', `/stories/${story.id}/export`, { token: ana.token });

    const { status } = await request('POST', '/stories/import', { body: exported });

    expect(status).toBe(401);
  });
});
