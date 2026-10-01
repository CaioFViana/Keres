import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  choices,
  scenes,
  showcaseSettings,
  storyPublications,
} from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { publicationStorageService } from '../../src/services/PublicationStorageService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let ana: TestUser;

async function enableShowcase(): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: true } });
}

async function publish(
  token: string,
  storyId: string,
  extra: Record<string, unknown> = {},
  labelMode = 'both',
) {
  const stored = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: stored!.lastOperationVersion, labelMode, ...extra },
  });
}

async function storedFiles(storyId: string): Promise<string[]> {
  try {
    return (
      await readdir(path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId))
    ).sort();
  } catch {
    return [];
  }
}

async function seedLinear(storyId: string): Promise<void> {
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'One', index: 1 });
  await db
    .insert(scenes)
    .values([{ id: newId(), storyId, chapterId, name: 'Filed', index: 1, body: 'Filed body.' }]);
}

/** A start, an ending, and one way between them. */
async function seedBranching(storyId: string): Promise<void> {
  const first = newId();
  const second = newId();
  await db.insert(scenes).values([
    {
      id: first,
      storyId,
      chapterId: null,
      name: 'Start',
      index: 1,
      body: 'Start body.',
      isStart: true,
    },
    { id: second, storyId, chapterId: null, name: 'End', index: 2, body: 'End body.' },
  ]);
  await db
    .insert(choices)
    .values({ id: newId(), storyId, sceneId: first, nextSceneId: second, text: 'Go on' });
}

async function protect(token: string, storyId: string, password = 'hunter2') {
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

describe('publishing with an online reader', () => {
  it('stores the reader page beside the package and records its size', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranching(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      reader: { includeSceneNames: true, language: 'en' },
    });

    expect(status).toBe(200);
    expect(data.readerByteSize).toBeGreaterThan(0);
    expect(data.manuscriptFormat).toBeNull();
    const files = await storedFiles(story.id);
    expect(files.some((file) => file.endsWith('.reader.html'))).toBe(true);
    const blob = await publicationStorageService.readReader(story.id, data.id);
    const html = Buffer.from(await (blob as Blob).arrayBuffer()).toString('utf8');
    expect(html).toContain('Start body.');
    expect(html).toContain('End body.');
    expect(html).toContain("default-src 'none'");
  });

  it('publishes a linear story as a reading page too', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);

    const { status, data } = await publish(ana.token, story.id, { reader: {} });

    expect(status).toBe(200);
    const blob = await publicationStorageService.readReader(story.id, data.id);
    const html = Buffer.from(await (blob as Blob).arrayBuffer()).toString('utf8');
    expect(html).toContain('Filed body.');
    expect(html).toContain('act-contents');
  });

  it('is independent of the manuscript: both can ship together', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);

    const { data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
      reader: {},
    });

    expect(data.manuscriptFormat).toBe('md');
    expect(data.readerByteSize).toBeGreaterThan(0);
    expect(await storedFiles(story.id)).toHaveLength(3);
  });

  it('uses the words the publisher sent for the reader interface', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranching(story.id);

    const { data } = await publish(ana.token, story.id, {
      reader: { readerLabels: { newGame: 'Começar a ler' } },
    });

    const blob = await publicationStorageService.readReader(story.id, data.id);
    expect(Buffer.from(await (blob as Blob).arrayBuffer()).toString('utf8')).toContain(
      'Começar a ler',
    );
  });

  it('refuses an arc from another story and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);

    const { status, data } = await publish(ana.token, story.id, { reader: { arcId: newId() } });

    expect(status).toBe(400);
    expect(data.message).toMatch(/Arc .* does not belong/);
    expect(await storedFiles(story.id)).toEqual([]);
  });

  it('refuses a style the shared schema rejects', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);

    const { status } = await publish(ana.token, story.id, {
      reader: { style: { fontSize: 99 } },
    });

    expect(status).toBe(400);
    expect(await storedFiles(story.id)).toEqual([]);
  });

  it('leaves the reader out unless asked', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);

    const { data } = await publish(ana.token, story.id);

    expect(data.readerByteSize).toBeNull();
    expect((await storedFiles(story.id)).some((file) => file.includes('.reader.'))).toBe(false);
  });
});

describe('reader metadata on public versions', () => {
  it('lists the reader on each version, and null when there is none', async () => {
    const withReader = await uploadTestStory(ana.token, 'Com Leitor');
    await seedLinear(withReader.id);
    const { data: publication } = await publish(ana.token, withReader.id, { reader: {} });
    const without = await uploadTestStory(ana.token, 'Sem Leitor');
    await publish(ana.token, without.id);

    const detail = await request('GET', `/public/stories/${withReader.id}`);
    expect(detail.data.versions[0].reader).toEqual({ byteSize: publication.readerByteSize });
    const other = await request('GET', `/public/stories/${without.id}`);
    expect(other.data.versions[0].reader).toBeNull();
    const cards = await request('GET', '/public/stories');
    const card = cards.data.find((entry: { storyId: string }) => entry.storyId === withReader.id);
    expect(card.latestVersion.reader).toEqual({ byteSize: publication.readerByteSize });
  });

  it('leaks nothing of the reader through the protected stub', async () => {
    const story = await uploadTestStory(ana.token, 'Segredo');
    await seedLinear(story.id);
    await publish(ana.token, story.id, { reader: {} });
    await protect(ana.token, story.id);

    const { data } = await request('GET', `/public/stories/${story.id}`);

    expect(data).toEqual({ storyId: story.id, protected: true });
  });
});

describe('GET /public/stories/:storyId/publications/:publicationId/reader', () => {
  it('serves the page sandboxed, without a way to reach anything', async () => {
    const story = await uploadTestStory(ana.token, 'A Queda');
    await seedLinear(story.id);
    const { data: publication } = await publish(ana.token, story.id, { reader: {} });

    const { status, headers } = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/reader`,
    );

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('text/html');
    const policy = headers.get('content-security-policy') ?? '';
    expect(policy).toContain('sandbox allow-scripts');
    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toContain('allow-same-origin');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('cache-control')).toContain('immutable');
  });

  it('404s for a version published without a reader, or never published', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);
    const { data: publication } = await publish(ana.token, story.id);

    const none = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/reader`,
    );
    const ghost = await request(
      'GET',
      `/public/stories/${story.id}/publications/${newId()}/reader`,
    );

    expect(none.status).toBe(404);
    expect(ghost.status).toBe(404);
  });

  it('refuses a protected story without its token, and keeps it out of shared caches', async () => {
    const story = await uploadTestStory(ana.token, 'Segredo');
    await seedLinear(story.id);
    const { data: publication } = await publish(ana.token, story.id, { reader: {} });
    await protect(ana.token, story.id);

    const refused = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/reader`,
    );
    expect(refused.status).toBe(404);

    const unlocked = await request('POST', `/public/stories/${story.id}/unlock`, {
      body: { password: 'hunter2' },
    });
    const link = await request(
      'POST',
      `/public/stories/${story.id}/publications/${publication.id}/reader/url`,
      { headers: { authorization: `Showcase ${unlocked.data.token}` } },
    );
    expect(link.data.url).toContain('access=');
    const page = await request('GET', link.data.url);
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toContain('no-store');
  });
});

describe('with the showcase off', () => {
  it('answers 404 to the reader page and to its address, like the rest of the public site', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);
    const { data: publication } = await publish(ana.token, story.id, { reader: {} });
    await db
      .update(showcaseSettings)
      .set({ isShowcaseEnabled: false })
      .where(eq(showcaseSettings.id, SHOWCASE_SETTINGS_SINGLETON_ID));

    const page = await request(
      'GET',
      `/public/stories/${story.id}/publications/${publication.id}/reader`,
    );
    const link = await request(
      'POST',
      `/public/stories/${story.id}/publications/${publication.id}/reader/url`,
    );

    expect(page.status).toBe(404);
    expect(link.status).toBe(404);
  });
});

describe('POST .../reader/url', () => {
  it('hands a public story a plain address', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);
    const { data: publication } = await publish(ana.token, story.id, { reader: {} });

    const { status, data } = await request(
      'POST',
      `/public/stories/${story.id}/publications/${publication.id}/reader/url`,
    );

    expect(status).toBe(200);
    expect(data.url).toBe(`/api/public/stories/${story.id}/publications/${publication.id}/reader`);
  });

  it('404s without a reader, or for a protected story without its token', async () => {
    const plain = await uploadTestStory(ana.token, 'Plain');
    await seedLinear(plain.id);
    const { data: bare } = await publish(ana.token, plain.id);
    const closed = await uploadTestStory(ana.token, 'Closed');
    await seedLinear(closed.id);
    const { data: locked } = await publish(ana.token, closed.id, { reader: {} });
    await protect(ana.token, closed.id);

    const withoutReader = await request(
      'POST',
      `/public/stories/${plain.id}/publications/${bare.id}/reader/url`,
    );
    const withoutToken = await request(
      'POST',
      `/public/stories/${closed.id}/publications/${locked.id}/reader/url`,
    );

    expect(withoutReader.status).toBe(404);
    expect(withoutToken.status).toBe(404);
  });
});

describe('reader blob lifetime', () => {
  it('prunes the reader with its version, and deletes it with the version and on unpublish', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinear(story.id);
    const ids: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const published = await publish(ana.token, story.id, { reader: {} }, 'date');
      expect(published.status).toBe(200);
      ids.push(published.data.id);
    }
    const rows = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, story.id));
    expect(rows).toHaveLength(5);
    const files = await storedFiles(story.id);
    expect(files.filter((file) => file.endsWith('.reader.html'))).toHaveLength(5);
    expect(files.some((file) => file.startsWith(ids[0]))).toBe(false);

    const removed = await request('DELETE', `/stories/${story.id}/publications/${ids[5]}`, {
      token: ana.token,
    });
    expect(removed.status).toBe(200);
    expect(
      (await storedFiles(story.id)).filter((file) => file.endsWith('.reader.html')),
    ).toHaveLength(4);

    const gone = await request('DELETE', `/stories/${story.id}/publications`, {
      token: ana.token,
    });
    expect(gone.status).toBe(200);
    expect(await storedFiles(story.id)).toEqual([]);
  });
});
