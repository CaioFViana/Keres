import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { env } from '../../src/config/env';
import { db } from '../../src/db';
import { galleries, showcaseSettings, stories } from '../../src/db/schema';
import { mediaStorageService } from '../../src/services/MediaStorageService';
import { installBunShim } from '../helpers/bunShim';
import { newId, registerUser, request, uploadTestStory, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

installBunShim();

let ana: TestUser;

const seedGallery = async (storyId: string, hash: string) => {
  const now = new Date();
  await db.insert(galleries).values({
    id: newId(),
    storyId,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'retrato.png',
    hash,
    sizeBytes: 9,
    title: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);
};

const publishCurrent = async (token: string, storyId: string) => {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: story!.lastOperationVersion, labelMode: 'version' },
  });
};

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await db
    .insert(showcaseSettings)
    .values({ id: 'singleton', isShowcaseEnabled: true })
    .onConflictDoNothing();
});

describe('publication media lifecycle', () => {
  it('embeds every blob the story references', async () => {
    const story = await uploadTestStory(ana.token);
    const bytes = new TextEncoder().encode('bytes-da-foto').buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    await mediaStorageService.store(hash, 'image/png', bytes);
    await seedGallery(story.id, hash);

    const { status, data } = await publishCurrent(ana.token, story.id);

    expect(status).toBe(200);
    expect(data).toMatchObject({ mediaIncluded: 1, mediaTotal: 1 });
  });

  it('publishes without the media it cannot find', async () => {
    const story = await uploadTestStory(ana.token);
    await seedGallery(story.id, 'f'.repeat(32));

    const { status, data } = await publishCurrent(ana.token, story.id);

    expect(status).toBe(200);
    expect(data).toMatchObject({ mediaIncluded: 0, mediaTotal: 1 });
  });

  it('answers 404 downloading a version whose file is gone', async () => {
    const story = await uploadTestStory(ana.token);
    const { status, data } = await publishCurrent(ana.token, story.id);
    expect(status).toBe(200);
    const publicationId = (data as { id: string }).id;
    await unlink(
      path.join(env.MEDIA_STORAGE_PATH, 'publications', story.id, `${publicationId}.zip`),
    );

    expect(
      (
        await request(
          'GET',
          `/public/stories/${story.id}/publications/${publicationId}/download`,
          {},
        )
      ).status,
    ).toBe(404);
  });
});

describe('media storage reads', () => {
  it('rejects bytes whose content hash disagrees with the declared one', async () => {
    const bytes = new TextEncoder().encode('conteúdo-trocado').buffer as ArrayBuffer;

    await expect(mediaStorageService.store('0'.repeat(32), 'image/png', bytes)).rejects.toThrow(
      /hash mismatch/i,
    );
  });

  it('returns null when the file behind a record is gone', async () => {
    const bytes = new TextEncoder().encode('foto-orfã').buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    await mediaStorageService.store(hash, 'image/png', bytes);
    await unlink(path.join(env.MEDIA_STORAGE_PATH, `${hash.slice(0, 2)}`, hash));

    expect(await mediaStorageService.has(hash)).toBe(false);
    expect(await mediaStorageService.read(hash)).toBeNull();
  });

  it('ignores a cleanup for a hash nobody stored', async () => {
    await expect(
      mediaStorageService.deleteBlobIfUnreferenced('0'.repeat(32)),
    ).resolves.toBeUndefined();
  });
});
