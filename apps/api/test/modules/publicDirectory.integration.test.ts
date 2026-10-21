import { createHash } from 'node:crypto';
import { CURRENT_STORY_FORMAT_VERSION, type StoryPublicationSnapshot } from '@keres/shared';
import { ulid } from 'ulid';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import {
  galleries,
  showcaseSettings,
  stories,
  storyArcs,
  storyPublications,
  storyShowcaseEntries,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '@/db/schema/tables/showcaseSettings';
import { mediaStorageService } from '@/services/media-storage/MediaStorageService';
import { registerUser, request, type TestUser } from '@test/helpers/app';
import { installBunShim } from '@test/helpers/bunShim';
import { truncateAll } from '@test/helpers/database';

installBunShim();

/**
 * How the public site is browsed: search and filters over the story list, the facets they offer, the authors and
 * their pages, and the cover of a released work. Stories are seeded as rows (an entry and its versions) because
 * what is under test is what the site reads, not how a package is built.
 */

let ana: TestUser;
let bia: TestUser;

/** A 1x1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function enableShowcase(enabled = true): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: enabled } });
}

interface SeedWork {
  id: string;
  title: string;
  medium?: 'generic' | 'comic' | 'screenplay';
}

interface SeedStory {
  title: string;
  genre?: string;
  language?: string;
  author?: string;
  description?: string;
  type?: 'linear' | 'branching';
  nsfw?: boolean;
  visibility?: 'public' | 'password';
  works?: SeedWork[];
  updatedAt?: Date;
}

/** A published story: the row, its showcase entry, a version of the universe and one release per work. */
async function seedStory(owner: TestUser, story: SeedStory): Promise<string> {
  const storyId = ulid();
  await db.insert(stories).values({
    id: storyId,
    userId: owner.userId,
    title: story.title,
    type: story.type ?? 'linear',
    isNsfw: story.nsfw ?? false,
  });
  await db.insert(storyShowcaseEntries).values({
    storyId,
    ownerUserId: owner.userId,
    visibility: story.visibility ?? 'public',
    updatedAt: story.updatedAt ?? new Date(),
  });
  const snapshot: StoryPublicationSnapshot = {
    title: story.title,
    description: story.description ?? null,
    genre: story.genre ?? null,
    language: story.language ?? null,
    author: story.author ?? null,
    type: story.type ?? 'linear',
    theme: null,
  };
  const base = {
    storyId,
    ownerUserId: owner.userId,
    operationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    byteSize: 10,
    mediaIncluded: 0,
    mediaTotal: 0,
  };
  await db
    .insert(storyPublications)
    .values({ ...base, id: ulid(), label: 'v1', snapshot, createdAt: new Date(Date.now() - 1000) });
  for (const work of story.works ?? []) {
    await db.insert(storyArcs).values({ id: work.id, storyId, title: work.title });
    await db.insert(storyPublications).values({
      ...base,
      id: ulid(),
      arcId: work.id,
      label: `${work.title} v1`,
      snapshot: {
        ...snapshot,
        arc: {
          id: work.id,
          title: work.title,
          description: null,
          author: null,
          medium: work.medium ?? 'generic',
        },
      },
    });
  }
  return storyId;
}

async function giveWorkCover(
  storyId: string,
  arcId: string,
  over: { mimeType?: string; isDeleted?: boolean } = {},
): Promise<void> {
  const hash = createHash('md5').update(PNG).digest('hex');
  await mediaStorageService.store(
    hash,
    'image/png',
    PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) as ArrayBuffer,
  );
  const id = ulid();
  await db.insert(galleries).values({
    id,
    storyId,
    mediaType: 'image',
    mimeType: over.mimeType ?? 'image/png',
    fileName: 'work.png',
    hash,
    sizeBytes: PNG.byteLength,
    isDeleted: over.isDeleted ?? false,
  });
  await db.update(storyArcs).set({ coverGalleryId: id }).where(eq(storyArcs.id, arcId));
}

const search = (query = '', token?: string) =>
  request('GET', `/public/stories${query ? `?${query}` : ''}`, { token });
const titles = (response: { data: Array<{ snapshot: { title: string } }> }) =>
  response.data.map((card) => card.snapshot.title);

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  await enableShowcase();
});

describe('searching the story list', () => {
  beforeEach(async () => {
    await seedStory(ana, {
      title: 'A Queda',
      genre: 'Fantasia, Aventura',
      language: 'Português',
      author: 'Ana Souza',
      description: 'Um reino desmorona',
      updatedAt: new Date('2026-03-01'),
    });
    await seedStory(bia, {
      title: 'Zenith',
      genre: 'sci-fi / fantasia',
      language: 'english',
      type: 'branching',
      updatedAt: new Date('2026-02-01'),
      works: [{ id: ulid(), title: 'Ground Zero', medium: 'comic' }],
    });
    await seedStory(bia, {
      title: 'Brisa',
      genre: 'Romance',
      language: 'Português',
      updatedAt: new Date('2026-01-01'),
    });
  });

  it('answers the whole list, newest first, when nothing is asked', async () => {
    const response = await search();
    expect(titles(response)).toEqual(['A Queda', 'Zenith', 'Brisa']);
    expect(response.headers.get('x-total-count')).toBe('3');
  });

  it('finds by text in the title, description, author, publisher and work, ignoring case and accents', async () => {
    expect(titles(await search('q=QUEDA'))).toEqual(['A Queda']);
    expect(titles(await search('q=reino'))).toEqual(['A Queda']);
    expect(titles(await search('q=souza'))).toEqual(['A Queda']);
    expect(titles(await search('q=ground'))).toEqual(['Zenith']);
    expect(titles(await search('q=bia'))).toEqual(['Zenith', 'Brisa']);
    expect(titles(await search('q=portugues'))).toEqual(['A Queda', 'Brisa']);
    // Every word has to be there.
    expect(titles(await search('q=ana+reino'))).toEqual(['A Queda']);
    expect(titles(await search('q=ana+zenith'))).toEqual([]);
  });

  it('filters by genre (each one of a list), language, structure and the medium of a work', async () => {
    expect(titles(await search('genre=fantasia'))).toEqual(['A Queda', 'Zenith']);
    expect(titles(await search('genre=Aventura'))).toEqual(['A Queda']);
    expect(titles(await search('language=PORTUGUES'))).toEqual(['A Queda', 'Brisa']);
    expect(titles(await search('type=branching'))).toEqual(['Zenith']);
    expect(titles(await search('medium=comic'))).toEqual(['Zenith']);
    expect(titles(await search('medium=screenplay'))).toEqual([]);
  });

  it('adds the filters up', async () => {
    expect(titles(await search('genre=fantasia&language=english'))).toEqual(['Zenith']);
    expect(titles(await search('genre=fantasia&q=zenith&type=linear'))).toEqual([]);
  });

  it('orders by title or by author', async () => {
    expect(titles(await search('sort=title'))).toEqual(['A Queda', 'Brisa', 'Zenith']);
    // The declared author, else the publisher: ana (Ana Souza), bia, bia.
    expect(titles(await search('sort=author'))).toEqual(['A Queda', 'Zenith', 'Brisa']);
  });

  it('cuts a page and says how many matched', async () => {
    const first = await search('sort=title&limit=2');
    expect(titles(first)).toEqual(['A Queda', 'Brisa']);
    expect(first.headers.get('x-total-count')).toBe('3');
    const second = await search('sort=title&limit=2&offset=2');
    expect(titles(second)).toEqual(['Zenith']);
    expect(second.headers.get('x-total-count')).toBe('3');
  });

  it('refuses a query that makes no sense', async () => {
    expect((await search('sort=sideways')).status).toBe(400);
    expect((await search('limit=0')).status).toBe(400);
    expect((await search('limit=1000')).status).toBe(400);
    expect((await search('type=epic')).status).toBe(400);
  });

  it('tags a filtered listing apart from the whole one', async () => {
    const whole = await search();
    const filtered = await search('genre=romance');
    expect(filtered.headers.get('etag')).not.toBe(whole.headers.get('etag'));

    const again = await request('GET', '/public/stories?genre=romance', {
      headers: { 'if-none-match': filtered.headers.get('etag')! },
    });
    expect(again.status).toBe(304);
    const wrong = await request('GET', '/public/stories', {
      headers: { 'if-none-match': filtered.headers.get('etag')! },
    });
    expect(wrong.status).toBe(200);
  });

  it('never reaches a password story or an adults-only one, whatever is asked', async () => {
    await seedStory(ana, { title: 'Segredo', visibility: 'password', genre: 'Fantasia' });
    await seedStory(ana, { title: 'Adulto', nsfw: true, genre: 'Fantasia' });
    expect(titles(await search('genre=fantasia'))).toEqual(['A Queda', 'Zenith']);
    expect(titles(await search('q=segredo'))).toEqual([]);
    expect(titles(await search('q=adulto'))).toEqual([]);
  });
});

describe('GET /public/stories/facets', () => {
  it('counts genres, languages, mediums and structures, merging spellings that differ by case or accent', async () => {
    await seedStory(ana, { title: 'A', genre: 'Fantasia, Aventura', language: 'Português' });
    await seedStory(bia, {
      title: 'B',
      genre: 'fantasía',
      language: 'portugues',
      type: 'branching',
      works: [{ id: ulid(), title: 'W', medium: 'comic' }],
    });
    await seedStory(bia, { title: 'C', genre: 'Romance', language: 'Português' });
    await seedStory(bia, { title: 'D', language: 'English' });

    const { status, data } = await request('GET', '/public/stories/facets');
    expect(status).toBe(200);
    expect(data.genres).toEqual([
      { value: 'Fantasia', count: 2 },
      { value: 'Aventura', count: 1 },
      { value: 'Romance', count: 1 },
    ]);
    expect(data.languages).toEqual([
      { value: 'Português', count: 3 },
      { value: 'English', count: 1 },
    ]);
    expect(data.mediums).toEqual([{ value: 'comic', count: 1 }]);
    expect(data.types).toEqual([
      { value: 'linear', count: 3 },
      { value: 'branching', count: 1 },
    ]);
  });

  it('counts only what the viewer may see', async () => {
    await seedStory(ana, { title: 'A', genre: 'Fantasia' });
    await seedStory(ana, { title: 'Adulto', genre: 'Horror', nsfw: true });
    await seedStory(ana, { title: 'Segredo', genre: 'Mistério', visibility: 'password' });

    const { data } = await request('GET', '/public/stories/facets');
    expect(data.genres).toEqual([{ value: 'Fantasia', count: 1 }]);
  });
});

describe('the authors', () => {
  it('lists the accounts with something on show, most recently active first, with how many stories', async () => {
    await seedStory(ana, { title: 'A1', updatedAt: new Date('2026-01-01') });
    await seedStory(bia, { title: 'B1', updatedAt: new Date('2026-02-01') });
    await seedStory(bia, { title: 'B2', updatedAt: new Date('2026-03-01') });
    await registerUser('caio');

    const { status, data, headers } = await request('GET', '/public/authors');
    expect(status).toBe(200);
    expect(data.map((author: { owner: { username: string } }) => author.owner.username)).toEqual([
      'bia',
      'ana',
    ]);
    expect(data[0].storyCount).toBe(2);
    expect(headers.get('x-total-count')).toBe('2');
    // Nothing that identifies the account beyond what a story card already shows.
    expect(JSON.stringify(data)).not.toContain(bia.userId);
  });

  it('searches by name and pages', async () => {
    await seedStory(ana, { title: 'A1' });
    await seedStory(bia, { title: 'B1' });
    const found = await request('GET', '/public/authors?q=BI');
    expect(found.data).toHaveLength(1);
    expect(found.data[0].owner.username).toBe('bia');
    const paged = await request('GET', '/public/authors?limit=1&offset=1');
    expect(paged.data).toHaveLength(1);
    expect(paged.headers.get('x-total-count')).toBe('2');
  });

  it('leaves out an account whose only stories are not on show to the viewer', async () => {
    await seedStory(ana, { title: 'Adulto', nsfw: true });
    await seedStory(bia, { title: 'Segredo', visibility: 'password' });
    expect((await request('GET', '/public/authors')).data).toEqual([]);
  });

  it("shows an author's page: the texts written for it and the stories on show", async () => {
    await seedStory(ana, { title: 'A1', updatedAt: new Date('2026-01-01') });
    await seedStory(ana, { title: 'A2', updatedAt: new Date('2026-02-01') });
    await seedStory(ana, { title: 'Segredo', visibility: 'password' });
    await seedStory(bia, { title: 'B1' });
    await request('PUT', '/user/public-profile', {
      token: ana.token,
      body: {
        biography: 'I write comics.',
        links: [{ label: 'Site', url: 'https://example.com' }],
        theme: 'ocean',
      },
    });
    await request('PUT', '/user/profile', { token: ana.token, body: { bio: 'short bio' } });

    const { status, data } = await request('GET', '/public/authors/ana');
    expect(status).toBe(200);
    expect(data.owner.username).toBe('ana');
    expect(data.biography).toBe('I write comics.');
    expect(data.links).toEqual([{ label: 'Site', url: 'https://example.com' }]);
    expect(data.theme).toBe('ocean');
    expect(
      data.stories.map((card: { snapshot: { title: string } }) => card.snapshot.title),
    ).toEqual(['A2', 'A1']);
    // The short bio is for friends; the page carries only what was written for it.
    expect(JSON.stringify(data)).not.toContain('short bio');
    expect(JSON.stringify(data)).not.toContain(ana.userId);
  });

  it('has an empty page for an author who wrote nothing, and none for one with nothing on show', async () => {
    await seedStory(ana, { title: 'A1' });
    const empty = await request('GET', '/public/authors/ana');
    expect(empty.data).toMatchObject({ biography: null, links: [], theme: null });

    expect((await request('GET', '/public/authors/nobody')).status).toBe(404);
    await seedStory(bia, { title: 'Adulto', nsfw: true });
    expect((await request('GET', '/public/authors/bia')).status).toBe(404);
  });

  it('answers 404 while the showcase is off', async () => {
    await seedStory(ana, { title: 'A1' });
    await enableShowcase(false);
    expect((await request('GET', '/public/authors')).status).toBe(404);
    expect((await request('GET', '/public/authors/ana')).status).toBe(404);
    expect((await request('GET', '/public/stories/facets')).status).toBe(404);
  });
});

describe('the cover of a released work', () => {
  it('is said to exist on the story page and is served as the picture it is', async () => {
    const arcId = ulid();
    const storyId = await seedStory(ana, {
      title: 'Zenith',
      works: [{ id: arcId, title: 'Ground Zero', medium: 'comic' }],
    });
    await giveWorkCover(storyId, arcId);

    const detail = await request('GET', `/public/stories/${storyId}`);
    expect(detail.data.workCovers).toEqual([arcId]);

    const cover = await request('GET', `/public/stories/${storyId}/works/${arcId}/cover`);
    expect(cover.status).toBe(200);
    expect(cover.headers.get('content-type')).toBe('image/png');
    expect(cover.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('is not there for a work with none, one that was deleted, or a picture a page may not draw', async () => {
    const withNone = ulid();
    const gone = ulid();
    const vector = ulid();
    const storyId = await seedStory(ana, {
      title: 'Zenith',
      works: [
        { id: withNone, title: 'One' },
        { id: gone, title: 'Two' },
        { id: vector, title: 'Three' },
      ],
    });
    await giveWorkCover(storyId, gone, { isDeleted: true });
    await giveWorkCover(storyId, vector, { mimeType: 'image/svg+xml' });

    const detail = await request('GET', `/public/stories/${storyId}`);
    expect(detail.data.workCovers).toEqual([]);
    for (const arcId of [withNone, gone, vector]) {
      expect((await request('GET', `/public/stories/${storyId}/works/${arcId}/cover`)).status).toBe(
        404,
      );
    }
  });

  it('is not served for a work that was never released', async () => {
    const storyId = await seedStory(ana, { title: 'Zenith' });
    const unreleased = ulid();
    await db.insert(storyArcs).values({ id: unreleased, storyId, title: 'Draft' });
    await giveWorkCover(storyId, unreleased);
    expect(
      (await request('GET', `/public/stories/${storyId}/works/${unreleased}/cover`)).status,
    ).toBe(404);
  });

  it('keeps the gates of the story: a password story and an adults-only one answer 404', async () => {
    const arcId = ulid();
    const secret = await seedStory(ana, {
      title: 'Segredo',
      visibility: 'password',
      works: [{ id: arcId, title: 'W' }],
    });
    await giveWorkCover(secret, arcId);
    expect((await request('GET', `/public/stories/${secret}/works/${arcId}/cover`)).status).toBe(
      404,
    );

    const adultArc = ulid();
    const adult = await seedStory(ana, {
      title: 'Adulto',
      nsfw: true,
      works: [{ id: adultArc, title: 'W' }],
    });
    await giveWorkCover(adult, adultArc);
    expect((await request('GET', `/public/stories/${adult}/works/${adultArc}/cover`)).status).toBe(
      404,
    );
  });
});
