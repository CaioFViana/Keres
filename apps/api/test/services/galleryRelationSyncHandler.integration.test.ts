import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { GalleryRelationSyncHandler } from '../../src/services/entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let galleryId: string;
let owners: Record<string, string>;
const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  const chapterId = newId();
  const locationId = newId();
  const characterId = newId();
  const sceneId = newId();
  const itemId = newId();
  const noteId = newId();
  const worldRuleId = newId();
  galleryId = newId();
  owners = {
    Character: characterId,
    Location: locationId,
    Scene: sceneId,
    Item: itemId,
    Note: noteId,
    WorldRule: worldRuleId,
  };
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
  await new ChapterSyncHandler().create(
    userId,
    storyId,
    create('Chapter', chapterId, {
      name: 'Prólogo',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new LocationSyncHandler().create(
    userId,
    storyId,
    create('Location', locationId, {
      name: 'Olimpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new CharacterSyncHandler().create(
    userId,
    storyId,
    create('Character', characterId, { name: 'Keres' }),
  );
  await new SceneSyncHandler().create(
    userId,
    storyId,
    create('Scene', sceneId, {
      chapterId,
      locationId,
      name: 'Chegada',
      index: 1,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isStart: true,
      isFinish: false,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new ItemSyncHandler().create(
    userId,
    storyId,
    create('Item', itemId, {
      characterOwnerId: characterId,
      name: 'Chave',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new NoteSyncHandler().create(
    userId,
    storyId,
    create('Note', noteId, { title: 'Profecia', body: null, isFavorite: false, extraNotes: null }),
  );
  await new WorldRuleSyncHandler().create(
    userId,
    storyId,
    create('WorldRule', worldRuleId, {
      title: 'A magia cobra um preço',
      description: null,
      section: 'rule',
      type: null,
      category: null,
      behavior: null,
      usability: null,
      danger: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new GallerySyncHandler().create(
    userId,
    storyId,
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
  );
});

describe('gallery relation sync handler', () => {
  it.each(['Character', 'Location', 'Note', 'Scene', 'Item', 'WorldRule'] as const)(
    'links a gallery to a valid %s owner',
    async (ownerType) => {
      const handler = new GalleryRelationSyncHandler();
      const id = newId();
      await handler.create(
        userId,
        storyId,
        create('GalleryRelation', id, { galleryId, ownerId: owners[ownerType], ownerType }),
      );
      expect(await handler.findByIdOrThrow(id)).toMatchObject({
        galleryId,
        ownerId: owners[ownerType],
        ownerType,
        isDeleted: false,
      });
    },
  );

  it('rejects duplicates and can retarget a relation to another valid owner', async () => {
    const handler = new GalleryRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      storyId,
      create('GalleryRelation', id, {
        galleryId,
        ownerId: owners.Character,
        ownerType: 'Character',
      }),
    );
    await expect(
      handler.create(
        userId,
        storyId,
        create('GalleryRelation', newId(), {
          galleryId,
          ownerId: owners.Character,
          ownerType: 'Character',
        }),
      ),
    ).rejects.toThrow(/already linked/i);

    const current = await handler.findByIdOrThrow(id);
    await handler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'GalleryRelation',
        id,
        changes: { ownerId: owners.Item, ownerType: 'Item', version: 1 },
      } as UpdateStoryUpdate,
      current,
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      ownerId: owners.Item,
      ownerType: 'Item',
      version: 2,
    });
  });
});
