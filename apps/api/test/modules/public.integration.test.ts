import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings } from '../../src/db/schema';
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
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: enabled } });
}

async function publishedStory(token: string, title = 'A Queda') {
  const { data: story } = await request('POST', '/stories/', {
    token,
    body: { title, type: 'linear' },
  });
  const stored = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, story.id),
  });
  const { data: publication } = await request('POST', `/stories/${story.id}/publications`, {
    token,
    body: { operationVersion: stored!.lastOperationVersion },
  });
  return { story, publication };
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('GET /public/config', () => {
  it('answers even while the showcase is disabled', async () => {
    await enableShowcase(false);
    const { status, data } = await request('GET', '/public/config');
    expect(status).toBe(200);
    expect(data.showcaseEnabled).toBe(false);
  });

  it('reports an enabled showcase', async () => {
    const { data } = await request('GET', '/public/config');
    expect(data.showcaseEnabled).toBe(true);
  });
});

describe('GET /public/stories', () => {
  it('lists a published story with its owner and latest version, with no session', async () => {
    const { story } = await publishedStory(ana.token, 'A Queda');

    const { status, data } = await request('GET', '/public/stories');
    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].storyId).toBe(story.id);
    expect(data[0].snapshot.title).toBe('A Queda');
    expect(data[0].owner.username).toBe('ana');
    expect(data[0].versionCount).toBe(1);
    // Nada de id de usuário no payload anônimo.
    expect(JSON.stringify(data)).not.toContain(ana.userId);
  });

  it('omits stories that were never published', async () => {
    await request('POST', '/stories/', { token: ana.token, body: { title: 'X', type: 'linear' } });
    const { data } = await request('GET', '/public/stories');
    expect(data).toEqual([]);
  });

  it('omits password-protected stories', async () => {
    const { story } = await publishedStory(ana.token);
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    const { data } = await request('GET', '/public/stories');
    expect(data).toEqual([]);
  });

  it('answers 304 to a matching If-None-Match', async () => {
    await publishedStory(ana.token);

    const first = await request('GET', '/public/stories');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await request('GET', '/public/stories', {
      headers: { 'if-none-match': etag! },
    });
    expect(second.status).toBe(304);
  });

  it('404s while the showcase is disabled', async () => {
    await publishedStory(ana.token);
    await enableShowcase(false);

    const { status } = await request('GET', '/public/stories');
    expect(status).toBe(404);
  });
});

describe('GET /public/stories/:storyId', () => {
  it('serves the detail of a public story', async () => {
    const { story, publication } = await publishedStory(ana.token);

    const { status, data } = await request('GET', `/public/stories/${story.id}`);
    expect(status).toBe(200);
    expect(data.snapshot.title).toBe('A Queda');
    expect(data.versions).toHaveLength(1);
    expect(data.versions[0].id).toBe(publication.id);
  });

  it('404s for a story that does not exist', async () => {
    const { status } = await request('GET', '/public/stories/01ARZ3NDEKTSV4RRFFQ69G5FAV');
    expect(status).toBe(404);
  });

  it('reveals nothing at all about a password-protected story', async () => {
    const { story } = await publishedStory(ana.token, 'Segredo');
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    const { status, data } = await request('GET', `/public/stories/${story.id}`);
    expect(status).toBe(200);
    expect(data).toEqual({ storyId: story.id, protected: true });
    expect(JSON.stringify(data)).not.toContain('Segredo');
  });
});

describe('POST /public/stories/:storyId/unlock', () => {
  async function protectedStory(password = 'hunter2') {
    const { story, publication } = await publishedStory(ana.token, 'Segredo');
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password },
    });
    return { story, publication };
  }

  it('returns a token that opens the story detail', async () => {
    const { story } = await protectedStory();

    const unlocked = await request('POST', `/public/stories/${story.id}/unlock`, {
      body: { password: 'hunter2' },
    });
    expect(unlocked.status).toBe(200);
    expect(unlocked.data.token).toBeTruthy();

    const detail = await request('GET', `/public/stories/${story.id}`, {
      headers: { authorization: `Showcase ${unlocked.data.token}` },
    });
    expect(detail.data.snapshot.title).toBe('Segredo');
  });

  it('gives the same answer for a wrong password and a story that does not exist', async () => {
    const { story } = await protectedStory();

    const wrong = await request('POST', `/public/stories/${story.id}/unlock`, {
      body: { password: 'nope' },
    });
    const missing = await request('POST', '/public/stories/01ARZ3NDEKTSV4RRFFQ69G5FAV/unlock', {
      body: { password: 'nope' },
    });

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.data.message).toBe(missing.data.message);
  });

  it('does not accept a token minted for another story', async () => {
    const first = await protectedStory();
    const second = await publishedStory(ana.token, 'Outra');
    await request('PUT', `/stories/${second.story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'outra-senha' },
    });

    const unlocked = await request('POST', `/public/stories/${first.story.id}/unlock`, {
      body: { password: 'hunter2' },
    });

    const detail = await request('GET', `/public/stories/${second.story.id}`, {
      headers: { authorization: `Showcase ${unlocked.data.token}` },
    });
    expect(detail.data).toEqual({ storyId: second.story.id, protected: true });
  });

  it('stops answering after too many attempts', async () => {
    const { story } = await protectedStory();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt++) {
      const { status } = await request('POST', `/public/stories/${story.id}/unlock`, {
        body: { password: 'nope' },
      });
      statuses.push(status);
    }

    expect(statuses).toContain(429);
  });
});

describe('GET /public/stories/:storyId/publications/:publicationId/download', () => {
  it('serves the package of a public story', async () => {
    const { story, publication } = await publishedStory(ana.token);

    const { status, headers } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/download`,
    );
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('application/zip');
    expect(headers.get('content-disposition')).toContain('.zip');
  });

  it('404s for a publication that belongs to another story', async () => {
    const first = await publishedStory(ana.token, 'Uma');
    const second = await publishedStory(ana.token, 'Outra');

    const { status } = await request(
      'GET',
      `/public/stories/${first.story.id}/publications/${second.publication.id}/download`,
    );
    expect(status).toBe(404);
  });

  it('refuses an unauthenticated download of a protected story', async () => {
    const { story, publication } = await publishedStory(ana.token);
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    const { status } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/download`,
    );
    expect(status).toBe(404);
  });

  it('hands a public story a plain link and a protected one a tokenised link', async () => {
    const open = await publishedStory(ana.token, 'Aberta');
    const openLink = await request(
      'POST',
      `/public/stories/${open.story.id}/publications/${open.publication.id}/download-url`,
    );
    expect(openLink.data.url).not.toContain('access=');

    const closed = await publishedStory(ana.token, 'Fechada');
    await request('PUT', `/stories/${closed.story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });
    const unlocked = await request('POST', `/public/stories/${closed.story.id}/unlock`, {
      body: { password: 'hunter2' },
    });
    const closedLink = await request(
      'POST',
      `/public/stories/${closed.story.id}/publications/${closed.publication.id}/download-url`,
      { headers: { authorization: `Showcase ${unlocked.data.token}` } },
    );
    expect(closedLink.data.url).toContain('access=');

    // E esse link realmente abre o download.
    const download = await request('GET', closedLink.data.url);
    expect(download.status).toBe(200);
  });
});
