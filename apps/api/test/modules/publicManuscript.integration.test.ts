import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let ana: TestUser;

async function enableShowcase(enabled = true): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: enabled } });
}

async function publish(
  token: string,
  storyId: string,
  extra: Record<string, unknown> = {},
  labelMode = 'both',
) {
  const stored = await db.query.stories.findFirst({
    where: (stories, { eq }) => eq(stories.id, storyId),
  });
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: stored!.lastOperationVersion, labelMode, ...extra },
  });
}

async function publishedStory(token: string, title = 'A Queda', manuscript?: unknown) {
  const story = await uploadTestStory(token, title);
  const { data: publication } = await publish(
    token,
    story.id,
    manuscript === undefined ? {} : { manuscript },
  );
  return { story, publication };
}

async function protectStory(token: string, storyId: string, password = 'hunter2') {
  await request('PUT', `/stories/${storyId}/showcase`, {
    token,
    body: { visibility: 'password', password },
  });
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('manuscript metadata on public versions', () => {
  it('lists the manuscript rendition on each version', async () => {
    const { story, publication } = await publishedStory(ana.token, 'A Queda', { format: 'md' });

    const { status, data } = await request('GET', `/public/stories/${story.id}`);
    expect(status).toBe(200);
    expect(data.versions).toHaveLength(1);
    expect(data.versions[0].manuscript).toEqual({
      format: 'md',
      byteSize: publication.manuscriptByteSize,
    });

    const cards = await request('GET', '/public/stories');
    expect(cards.data[0].latestVersion.manuscript).toEqual({
      format: 'md',
      byteSize: publication.manuscriptByteSize,
    });
  });

  it('reports a null manuscript for versions published without one', async () => {
    const { story } = await publishedStory(ana.token);

    const { data } = await request('GET', `/public/stories/${story.id}`);
    expect(data.versions[0].manuscript).toBeNull();
  });

  it('leaks no manuscript metadata through the protected stub', async () => {
    const { story } = await publishedStory(ana.token, 'Segredo', { format: 'md' });
    await protectStory(ana.token, story.id);

    const { status, data } = await request('GET', `/public/stories/${story.id}`);
    expect(status).toBe(200);
    expect(data).toEqual({ storyId: story.id, protected: true });
    expect(JSON.stringify(data)).not.toContain('manuscript');
  });
});

describe('GET /public/stories/:storyId/publications/:publicationId/manuscript/download', () => {
  it('serves the manuscript of a public story', async () => {
    const { story, publication } = await publishedStory(ana.token, 'A Queda', { format: 'md' });

    const { status, headers } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/manuscript/download`,
    );
    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/markdown');
    expect(headers.get('content-disposition')).toContain(
      `a-queda-${publication.label}-manuscript.md`,
    );
    expect(headers.get('cache-control')).toContain('immutable');
  });

  it('404s for a version published without a manuscript', async () => {
    const { story, publication } = await publishedStory(ana.token);

    const { status } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/manuscript/download`,
    );
    expect(status).toBe(404);
  });

  it('404s for a version that was never published', async () => {
    const { story } = await publishedStory(ana.token, 'A Queda', { format: 'md' });

    const { status } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${newId()}/manuscript/download`,
    );
    expect(status).toBe(404);
  });

  it('refuses an unauthenticated manuscript download of a protected story', async () => {
    const { story, publication } = await publishedStory(ana.token, 'Segredo', { format: 'md' });
    await protectStory(ana.token, story.id);

    const { status } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/manuscript/download`,
    );
    expect(status).toBe(404);
  });
});

describe('POST .../manuscript/download-url', () => {
  it('hands a public story a plain link and a protected one a tokenised link', async () => {
    const open = await publishedStory(ana.token, 'Aberta', { format: 'md' });
    const openLink = await request(
      'POST',
      `/public/stories/${open.story.id}/publications/${open.publication.id}/manuscript/download-url`,
    );
    expect(openLink.status).toBe(200);
    expect(openLink.data.url).not.toContain('access=');
    expect(openLink.data.url).toContain('/manuscript/download');

    const closed = await publishedStory(ana.token, 'Fechada', { format: 'md' });
    await protectStory(ana.token, closed.story.id);
    const unlocked = await request('POST', `/public/stories/${closed.story.id}/unlock`, {
      body: { password: 'hunter2' },
    });
    const closedLink = await request(
      'POST',
      `/public/stories/${closed.story.id}/publications/${closed.publication.id}/manuscript/download-url`,
      { headers: { authorization: `Showcase ${unlocked.data.token}` } },
    );
    expect(closedLink.data.url).toContain('access=');

    const download = await request('GET', closedLink.data.url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toContain('text/markdown');
  });

  it('404s a manuscript link for a story that was never published', async () => {
    const story = await uploadTestStory(ana.token);

    const { status } = await request(
      'POST',
      `/public/stories/${story.id}/publications/${newId()}/manuscript/download-url`,
    );
    expect(status).toBe(404);
  });

  it('404s a manuscript link for a version published without one', async () => {
    const { story, publication } = await publishedStory(ana.token);

    const { status } = await request(
      'POST',
      `/public/stories/${story.id}/publications/${publication.id}/manuscript/download-url`,
    );
    expect(status).toBe(404);
  });

  it('404s a manuscript link for a protected story without its token', async () => {
    const { story, publication } = await publishedStory(ana.token, 'Segredo', { format: 'md' });
    await protectStory(ana.token, story.id);

    const { status } = await request(
      'POST',
      `/public/stories/${story.id}/publications/${publication.id}/manuscript/download-url`,
    );
    expect(status).toBe(404);
  });
});
