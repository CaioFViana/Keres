import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import { StorySyncHandler } from '../../src/services/entity-sync-handlers/StorySyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;

const create = (entity: string, id: string, data: Record<string, unknown>, operationTime?: string) => ({ type: 'create', entity, id, data, operationTime } as CreateStoryUpdate);

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  await db.insert(users).values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
});

describe('story and gallery sync entity handlers', () => {
  it('creates a story at the operation time and reorders every chapter atomically', async () => {
    const stories = new StorySyncHandler();
    const chapters = new ChapterSyncHandler();
    const storyId = newId();
    const firstChapterId = newId();
    const secondChapterId = newId();
    const operationTime = '2025-01-02T03:04:05.000Z';
    await stories.create(userId, storyId, create('Story', storyId, { title: 'A Queda', type: 'linear', description: null, genre: null, language: null, author: null, isFavorite: false, favoriteBehavior: 'individual', extraNotes: null, theme: null, normalizeSceneTiming: false, allowReaderComments: false }, operationTime));
    await chapters.create(userId, storyId, create('Chapter', firstChapterId, { name: 'Primeiro', index: 1, summary: null, isFavorite: false, extraNotes: null }));
    await chapters.create(userId, storyId, create('Chapter', secondChapterId, { name: 'Segundo', index: 2, summary: null, isFavorite: false, extraNotes: null }));

    const current = await stories.findById(storyId);
    expect(current.createdAt).toEqual(new Date(operationTime));
    await stories.update(userId, storyId, { type: 'reorder', entity: 'Story', id: storyId, version: 1, reorderItems: [{ id: firstChapterId, newIndex: 2 }, { id: secondChapterId, newIndex: 1 }] } as any, current);
    expect(await chapters.findById(firstChapterId)).toMatchObject({ index: 2, version: 2 });
    expect(await chapters.findById(secondChapterId)).toMatchObject({ index: 1, version: 2 });
    expect(await stories.findById(storyId)).toMatchObject({ version: 2 });
  });

  it('validates gallery MIME consistency on create and update', async () => {
    const storyId = newId();
    const stories = new StorySyncHandler();
    const galleries = new GallerySyncHandler();
    await stories.create(userId, storyId, create('Story', storyId, { title: 'A Queda', type: 'linear' }, '2025-01-02T03:04:05.000Z'));

    await expect(galleries.create(userId, storyId, create('Gallery', newId(), { mediaType: 'image', mimeType: 'video/mp4', fileName: 'erro.mp4', hash: 'a'.repeat(32), sizeBytes: 1, title: null, isFavorite: false, extraNotes: null }))).rejects.toThrow(/does not match/i);

    const id = newId();
    await galleries.create(userId, storyId, create('Gallery', id, { mediaType: 'image', mimeType: 'image/png', fileName: 'nyx.png', hash: 'b'.repeat(32), sizeBytes: 1, title: null, isFavorite: false, extraNotes: null }));
    const current = await galleries.findById(id);
    await galleries.update(userId, storyId, { type: 'update', entity: 'Gallery', id, changes: { mimeType: 'audio/mpeg', mediaType: 'audio', fileName: 'nyx.mp3', version: 1 } } as UpdateStoryUpdate, current);
    expect(await galleries.findById(id)).toMatchObject({ mimeType: 'audio/mpeg', mediaType: 'audio', version: 2 });
  });
});
