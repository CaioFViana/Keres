import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { ChoiceSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceSyncHandler';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { TagRelationSyncHandler } from '../../src/services/entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from '../../src/services/entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let tagId: string;
let entities: Record<string, string>;
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
  const firstSceneId = newId();
  const secondSceneId = newId();
  const itemId = newId();
  const noteId = newId();
  const galleryId = newId();
  const worldRuleId = newId();
  const choiceId = newId();
  tagId = newId();
  entities = {
    Character: characterId,
    Location: locationId,
    Chapter: chapterId,
    Scene: firstSceneId,
    Item: itemId,
    Note: noteId,
    Gallery: galleryId,
    WorldRule: worldRuleId,
    Choice: choiceId,
  };
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'branching',
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
  const scenes = new SceneSyncHandler();
  for (const [id, name, index] of [
    [firstSceneId, 'Chegada', 1],
    [secondSceneId, 'Partida', 2],
  ] as const) {
    await scenes.create(
      userId,
      storyId,
      create('Scene', id, {
        chapterId,
        locationId,
        name,
        index,
        summary: null,
        gap: null,
        gapType: null,
        duration: null,
        durationType: null,
        isStart: index === 1,
        isFinish: index === 2,
        isFavorite: false,
        extraNotes: null,
      }),
    );
  }
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
  await new WorldRuleSyncHandler().create(
    userId,
    storyId,
    create('WorldRule', worldRuleId, {
      title: 'Nenhum mortal entra',
      description: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
  await new ChoiceSyncHandler().create(
    userId,
    storyId,
    create('Choice', choiceId, {
      sceneId: firstSceneId,
      nextSceneId: secondSceneId,
      text: 'Abrir o portão',
      notes: null,
    }),
  );
  await new TagSyncHandler().create(
    userId,
    storyId,
    create('Tag', tagId, { name: 'Divindade', color: null, isFavorite: false, extraNotes: null }),
  );
});

describe('tag relation sync handler', () => {
  it.each([
    'Character',
    'Location',
    'Scene',
    'Note',
    'Gallery',
    'WorldRule',
    'Choice',
    'Item',
    'Chapter',
  ] as const)('validates a tag relation to a %s', async (relationType) => {
    const handler = new TagRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      storyId,
      create('TagRelation', id, { tagId, relationId: entities[relationType], relationType }),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      tagId,
      relationId: entities[relationType],
      relationType,
      isDeleted: false,
    });
  });

  it('rejects an active duplicate tag relation', async () => {
    const handler = new TagRelationSyncHandler();
    await handler.create(
      userId,
      storyId,
      create('TagRelation', newId(), {
        tagId,
        relationId: entities.Character,
        relationType: 'Character',
      }),
    );
    await expect(
      handler.create(
        userId,
        storyId,
        create('TagRelation', newId(), {
          tagId,
          relationId: entities.Character,
          relationType: 'Character',
        }),
      ),
    ).rejects.toThrow(/already exists/i);
  });
});
