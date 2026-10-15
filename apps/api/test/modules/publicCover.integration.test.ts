import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { galleries, showcaseSettings, stories } from '@/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '@/db/schema/tables/showcaseSettings';
import { mediaStorageService } from '@/services/MediaStorageService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '@test/helpers/app';
import { installBunShim } from '@test/helpers/bunShim';
import { truncateAll } from '@test/helpers/database';

installBunShim();

let ana: TestUser;

/** A 1x1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function enableShowcase(): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: true } });
}

async function publishedStory(title = 'A Queda') {
  const story = await uploadTestStory(ana.token, title);
  const stored = await db.query.stories.findFirst({ where: eq(stories.id, story.id) });
  await request('POST', `/stories/${story.id}/publications`, {
    token: ana.token,
    body: { operationVersion: stored!.lastOperationVersion, labelMode: 'both' },
  });
  return story;
}

/** A Gallery picture of the story, stored on the server, made its cover. */
async function giveCover(
  storyId: string,
  over: { mimeType?: string; mediaType?: string; isDeleted?: boolean } = {},
): Promise<string> {
  const hash = createHash('md5').update(PNG).digest('hex');
  await mediaStorageService.store(
    hash,
    'image/png',
    PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength) as ArrayBuffer,
  );
  const id = newId();
  await db.insert(galleries).values({
    id,
    storyId,
    mediaType: over.mediaType ?? 'image',
    mimeType: over.mimeType ?? 'image/png',
    fileName: 'cover.png',
    hash,
    sizeBytes: PNG.byteLength,
    isDeleted: over.isDeleted ?? false,
  });
  await db.update(stories).set({ coverGalleryId: id }).where(eq(stories.id, storyId));
  return id;
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('the cover of a published story', () => {
  it('is said to exist on the story page and on its card, and is served as the picture it is', async () => {
    const story = await publishedStory();
    await giveCover(story.id);

    const detail = await request('GET', `/public/stories/${story.id}`);
    const cards = await request('GET', '/public/stories');
    const cover = await request('GET', `/public/stories/${story.id}/cover`);

    expect(detail.data.hasCover).toBe(true);
    expect(cards.data[0].hasCover).toBe(true);
    expect(cover.status).toBe(200);
    expect(cover.headers.get('content-type')).toBe('image/png');
    expect(cover.headers.get('x-content-type-options')).toBe('nosniff');
    expect(cover.headers.get('cache-control')).toContain('public');
  });

  it('is not there for a story with none', async () => {
    const story = await publishedStory();

    const detail = await request('GET', `/public/stories/${story.id}`);
    const cover = await request('GET', `/public/stories/${story.id}/cover`);

    expect(detail.data.hasCover).toBe(false);
    expect(cover.status).toBe(404);
  });

  it('is not there when the picture is gone, is not an image, or is not one a page may draw', async () => {
    const story = await publishedStory();

    await giveCover(story.id, { isDeleted: true });
    expect((await request('GET', `/public/stories/${story.id}/cover`)).status).toBe(404);

    await giveCover(story.id, { mediaType: 'link' });
    expect((await request('GET', `/public/stories/${story.id}/cover`)).status).toBe(404);

    await giveCover(story.id, { mimeType: 'image/svg+xml' });
    expect((await request('GET', `/public/stories/${story.id}/cover`)).status).toBe(404);
    expect((await request('GET', `/public/stories/${story.id}`)).data.hasCover).toBe(false);
  });

  it('is not served for a story that was never published', async () => {
    const story = await uploadTestStory(ana.token, 'Rascunho');
    await giveCover(story.id);

    expect((await request('GET', `/public/stories/${story.id}/cover`)).status).toBe(404);
  });

  it('keeps the gate of a password: nothing without the unlock, not even that it has a cover', async () => {
    const story = await publishedStory('Segredo');
    await giveCover(story.id);
    await request('PUT', `/stories/${story.id}/showcase`, {
      token: ana.token,
      body: { visibility: 'password', password: 'hunter2' },
    });

    const cover = await request('GET', `/public/stories/${story.id}/cover`);
    const detail = await request('GET', `/public/stories/${story.id}`);

    expect(cover.status).not.toBe(200);
    expect(detail.data).toEqual({ storyId: story.id, protected: true });
  });

  it('is the cover of the story as it is now, not as it was when a version was published', async () => {
    const story = await publishedStory();
    expect((await request('GET', `/public/stories/${story.id}`)).data.hasCover).toBe(false);

    await giveCover(story.id);

    expect((await request('GET', `/public/stories/${story.id}`)).data.hasCover).toBe(true);
  });
});
