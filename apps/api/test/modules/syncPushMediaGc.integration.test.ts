import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { mediaBlobs, tiers, users } from '../../src/db/schema';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import {
  MEDIA_BLOB_GRACE_PERIOD_MS,
  mediaStorageService,
} from '../../src/services/MediaStorageService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const galleryData = (hash: string) => ({
  mediaType: 'image',
  mimeType: 'image/png',
  fileName: 'nyx.png',
  hash,
  sizeBytes: 1,
  title: null,
  isFavorite: false,
  extraNotes: null,
});

const md5 = (text: string) => createHash('md5').update(text).digest('hex');

async function storeBlobRecord(hash: string) {
  await db.insert(mediaBlobs).values({
    hash,
    mimeType: 'image/png',
    sizeBytes: 1,
    storagePath: `${hash.slice(0, 2)}/${hash}`,
    createdAt: new Date(),
  });
}

async function blobRecord(hash: string) {
  return db.query.mediaBlobs.findFirst({ where: eq(mediaBlobs.hash, hash) });
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('post-commit media collection on push', () => {
  it('stamps the blob for a later sweep when a pushed gallery delete removes its last reference', async () => {
    const hash = md5(`delete-${newId()}`);
    const galleryId = newId();
    const created = await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: galleryId, version: 0, data: galleryData(hash) },
    ]);
    expect(created.data.conflicts).toEqual([]);
    await storeBlobRecord(hash);

    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Gallery', id: galleryId, version: 1 },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    expect(await blobRecord(hash)).toMatchObject({ unreferencedSince: expect.any(Date) });
  });

  it('stamps the replaced hash when a pushed gallery update swaps media', async () => {
    const oldHash = md5(`old-${newId()}`);
    const newHash = md5(`new-${newId()}`);
    const galleryId = newId();
    const created = await push(ana.token, storyId, [
      {
        type: 'create',
        entity: 'Gallery',
        id: galleryId,
        version: 0,
        data: galleryData(oldHash),
      },
    ]);
    expect(created.data.conflicts).toEqual([]);
    await storeBlobRecord(oldHash);

    const updated = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Gallery',
        id: galleryId,
        version: 1,
        changes: { hash: newHash, version: 1 },
      },
    ]);

    expect(updated.data.conflicts).toEqual([]);
    expect(await blobRecord(oldHash)).toMatchObject({ unreferencedSince: expect.any(Date) });
  });

  it('stamps the story blobs when a pushed story delete lands', async () => {
    const hash = md5(`story-${newId()}`);
    const galleryId = newId();
    const created = await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: galleryId, version: 0, data: galleryData(hash) },
    ]);
    expect(created.data.conflicts).toEqual([]);
    await storeBlobRecord(hash);

    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Story', id: storyId },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    expect(await blobRecord(hash)).toMatchObject({ unreferencedSince: expect.any(Date) });
  });

  it('reaps a stamped blob once its grace expires without a resurrection', async () => {
    const hash = md5(`sweep-${newId()}`);
    const galleryId = newId();
    const created = await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: galleryId, version: 0, data: galleryData(hash) },
    ]);
    expect(created.data.conflicts).toEqual([]);
    await storeBlobRecord(hash);
    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Gallery', id: galleryId, version: 1 },
    ]);
    expect(deleted.data.conflicts).toEqual([]);
    expect(await blobRecord(hash)).toMatchObject({ unreferencedSince: expect.any(Date) });

    // Seven days pass with nobody re-referencing it.
    await db
      .update(mediaBlobs)
      .set({ unreferencedSince: new Date(Date.now() - MEDIA_BLOB_GRACE_PERIOD_MS - 1_000) })
      .where(eq(mediaBlobs.hash, hash));
    await mediaStorageService.sweepExpiredUnreferencedBlobs();

    expect(await blobRecord(hash)).toBeUndefined();
  });

  it('keeps the blob when another live gallery still references it', async () => {
    const hash = md5(`shared-${newId()}`);
    const firstId = newId();
    const secondId = newId();
    await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: firstId, version: 0, data: galleryData(hash) },
    ]);
    // The second row reuses a hash its story already references, so the binding holds.
    await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: secondId, version: 0, data: galleryData(hash) },
    ]);
    await storeBlobRecord(hash);

    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Gallery', id: firstId, version: 1 },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    expect(await blobRecord(hash)).toBeTruthy();
  });

  /**
   * The collection runs after the push transaction commits, not inside it: bytes deleted
   * mid-transaction would stay deleted if that transaction rolled back, while the reference
   * came back to life - a silent, permanent loss no client would ever re-upload (every one of
   * them believes the server already has the bytes).
   */
  describe('storage quota on gallery metadata', () => {
    async function capStoryStorageAt(bytes: number) {
      const tierId = newId();
      await db.insert(tiers).values({
        id: tierId,
        name: `Tier ${tierId}`,
        isDefault: false,
        maxStories: null,
        maxEntitiesPerStory: null,
        maxEntitiesTotal: null,
        maxStorageBytesPerStory: bytes,
        maxStorageBytesTotal: null,
      } as never);
      await db.update(users).set({ tierId }).where(eq(users.id, ana.userId));
    }

    it('refuses gallery metadata that would breach the story storage ceiling', async () => {
      await capStoryStorageAt(10);

      const pushed = await push(ana.token, storyId, [
        {
          type: 'create',
          entity: 'Gallery',
          id: newId(),
          version: 0,
          data: { ...galleryData(md5(`quota-${newId()}`)), sizeBytes: 100 },
        },
      ]);

      // The same verdict as the bytes upload: accepting the row would strand metadata whose
      // bytes the server then 403s, with no path to ever heal.
      expect(pushed.data.conflicts).toHaveLength(1);
      expect(pushed.data.conflicts[0]).toMatchObject({ reason: 'limit_exceeded' });
    });

    it('accepts gallery metadata within the ceiling and refuses a growing update past it', async () => {
      await capStoryStorageAt(10);
      const galleryId = newId();
      const created = await push(ana.token, storyId, [
        {
          type: 'create',
          entity: 'Gallery',
          id: galleryId,
          version: 0,
          data: { ...galleryData(md5(`quota-ok-${newId()}`)), sizeBytes: 6 },
        },
      ]);
      expect(created.data.conflicts).toEqual([]);

      const grown = await push(ana.token, storyId, [
        {
          type: 'update',
          entity: 'Gallery',
          id: galleryId,
          version: 1,
          changes: { sizeBytes: 11, version: 1 },
        },
      ]);

      expect(grown.data.conflicts).toHaveLength(1);
      expect(grown.data.conflicts[0]).toMatchObject({ reason: 'limit_exceeded' });
    });
  });

  it('does not collect inside the handler, only after the push commits', async () => {
    const hash = md5(`handler-${newId()}`);
    const galleryId = newId();
    const created = await push(ana.token, storyId, [
      { type: 'create', entity: 'Gallery', id: galleryId, version: 0, data: galleryData(hash) },
    ]);
    expect(created.data.conflicts).toEqual([]);
    await storeBlobRecord(hash);

    const handler = new GallerySyncHandler();
    const current = await handler.findById(galleryId);
    await handler.delete(
      ana.userId,
      storyId,
      { type: 'delete', entity: 'Gallery', id: galleryId, version: 1 } as never,
      current!,
    );

    // The tombstone landed but the bytes are untouched: collection belongs to the push
    // coordinator, after the commit.
    expect((await handler.findById(galleryId))?.isDeleted).toBe(true);
    expect(await blobRecord(hash)).toBeTruthy();
  });
});
