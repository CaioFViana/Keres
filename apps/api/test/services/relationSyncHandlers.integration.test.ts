import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '@/db';
import { stories, users } from '@/db/schema';
import { CharacterRelationSyncHandler } from '@/services/entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSyncHandler } from '@/services/entity-sync-handlers/CharacterSyncHandler';
import { GalleryRelationSyncHandler } from '@/services/entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from '@/services/entity-sync-handlers/GallerySyncHandler';
import { LocationRelationSyncHandler } from '@/services/entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from '@/services/entity-sync-handlers/LocationSyncHandler';
import { NoteRelationSyncHandler } from '@/services/entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from '@/services/entity-sync-handlers/NoteSyncHandler';
import { TagRelationSyncHandler } from '@/services/entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from '@/services/entity-sync-handlers/TagSyncHandler';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

let userId: string;
let storyId: string;
let characterA: string;
let characterB: string;
let locationA: string;
let locationB: string;
let noteId: string;
let tagId: string;
let galleryId: string;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const remove = (entity: string, id: string, version: number) =>
  ({ type: 'delete', entity, id, version }) as DeleteStoryUpdate;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);

  characterA = newId();
  characterB = newId();
  locationA = newId();
  locationB = newId();
  noteId = newId();
  tagId = newId();
  galleryId = newId();
  const characters = new CharacterSyncHandler();
  const locations = new LocationSyncHandler();
  await characters.create(create('Character', characterA, { name: 'Keres' }), { userId, storyId });
  await characters.create(create('Character', characterB, { name: 'Nyx' }), { userId, storyId });
  await locations.create(
    create('Location', locationA, {
      name: 'Olímpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
  await locations.create(
    create('Location', locationB, {
      name: 'Submundo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
  await new NoteSyncHandler().create(
    create('Note', noteId, { title: 'Profecia', body: null, isFavorite: false, extraNotes: null }),
    { userId, storyId },
  );
  await new TagSyncHandler().create(
    create('Tag', tagId, { name: 'Divindade', color: null, isFavorite: false, extraNotes: null }),
    { userId, storyId },
  );
  await new GallerySyncHandler().create(
    create('Gallery', galleryId, {
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'nyx.png',
      hash: 'a'.repeat(32),
      sizeBytes: 1,
      title: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
});

describe('relation sync entity handlers', () => {
  it('creates, updates, and tombstones a normalized character relation', async () => {
    const handler = new CharacterRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('CharacterRelation', id, {
        character1Id: characterB,
        character2Id: characterA,
        relationType: 'siblings',
      }),
      { userId, storyId },
    );
    const created = await handler.findByIdOrThrow(id);

    expect(created).toMatchObject({
      character1Id: [characterA, characterB].sort()[0],
      relationType: 'siblings',
      version: 1,
    });
    await handler.update(
      {
        type: 'update',
        entity: 'CharacterRelation',
        id,
        changes: { relationType: 'rivals', version: 1 },
      } as UpdateStoryUpdate,
      created,
      { userId, storyId },
    );
    const updated = await handler.findByIdOrThrow(id);
    expect(updated).toMatchObject({ relationType: 'rivals', version: 2 });
    await handler.delete(remove('CharacterRelation', id, 2), updated, { userId, storyId });
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true, version: 3 });
  });

  it.each([
    [
      'TagRelation',
      () => new TagRelationSyncHandler(),
      () => ({ tagId, relationId: characterA, relationType: 'Character' }),
    ],
    [
      'NoteRelation',
      () => new NoteRelationSyncHandler(),
      () => ({ noteId, relationId: characterA, relationType: 'Character' }),
    ],
    [
      'GalleryRelation',
      () => new GalleryRelationSyncHandler(),
      () => ({ galleryId, ownerId: characterA, ownerType: 'Character' }),
    ],
    [
      'LocationRelation',
      () => new LocationRelationSyncHandler(),
      () => ({ locationAId: locationB, locationBId: locationA, relationType: 'connected_to' }),
    ],
  ])(
    'creates and tombstones %s only when its referenced entities belong to the story',
    async (entity, build, data) => {
      const handler = build() as any;
      const id = newId();
      await handler.create(create(entity, id, data()), { userId, storyId });
      const created = await handler.findByIdOrThrow(id);

      expect(created).toMatchObject({ id, storyId, version: 1, isDeleted: false });
      await handler.delete(remove(entity, id, 1), created, { userId, storyId });
      expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true, version: 2 });
    },
  );

  /**
   * Same dead-filter bug as the simple-entity rename check (see simpleSyncHandlers'
   * "collides with a different existing row" test): the uniqueness re-check on a relation
   * retarget filtered with `eq(id, update.id)` instead of `ne(id, update.id)`, so it could
   * never find a genuinely different colliding row. These prove a retarget that would
   * duplicate a different, already-existing relation is now rejected.
   */
  it('a CharacterRelation retarget that collides with a different existing relation is rejected', async () => {
    const characters = new CharacterSyncHandler();
    const characterC = newId();
    await characters.create(create('Character', characterC, { name: 'Hades' }), {
      userId,
      storyId,
    });

    const handler = new CharacterRelationSyncHandler();
    const firstId = newId();
    const secondId = newId();
    await handler.create(
      create('CharacterRelation', firstId, {
        character1Id: characterA,
        character2Id: characterC,
        relationType: 'siblings',
      }),
      { userId, storyId },
    );
    await handler.create(
      create('CharacterRelation', secondId, {
        character1Id: characterB,
        character2Id: characterC,
        relationType: 'rivals',
      }),
      { userId, storyId },
    );
    const second = await handler.findByIdOrThrow(secondId);

    const retarget = handler.update(
      {
        type: 'update',
        entity: 'CharacterRelation',
        id: secondId,
        changes: { character1Id: characterA, character2Id: characterC, version: 1 },
      } as UpdateStoryUpdate,
      second,
      { userId, storyId },
    );

    await expect(retarget).rejects.toThrow(/already exists/i);
    expect((await handler.findByIdOrThrow(secondId)).relationType).toBe('rivals');
  });

  it('a TagRelation retarget that collides with a different existing relation is rejected', async () => {
    const handler = new TagRelationSyncHandler();
    const firstId = newId();
    const secondId = newId();
    await handler.create(
      create('TagRelation', firstId, { tagId, relationId: characterA, relationType: 'Character' }),
      { userId, storyId },
    );
    await handler.create(
      create('TagRelation', secondId, { tagId, relationId: characterB, relationType: 'Character' }),
      { userId, storyId },
    );
    const second = await handler.findByIdOrThrow(secondId);

    const retarget = handler.update(
      {
        type: 'update',
        entity: 'TagRelation',
        id: secondId,
        changes: { relationId: characterA, version: 1 },
      } as UpdateStoryUpdate,
      second,
      { userId, storyId },
    );

    await expect(retarget).rejects.toThrow(/already exists/i);
    expect((await handler.findByIdOrThrow(secondId)).relationId).toBe(characterB);
  });
});
