import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { CharacterSceneSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSceneSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { CommentSyncHandler } from '../../src/services/entity-sync-handlers/CommentSyncHandler';
import { FavoriteSyncHandler } from '../../src/services/entity-sync-handlers/FavoriteSyncHandler';
import { ItemJourneySyncHandler } from '../../src/services/entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let characterId: string;
let sceneId: string;
let itemId: string;

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

  const chapterId = newId();
  const locationId = newId();
  characterId = newId();
  sceneId = newId();
  itemId = newId();
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
      name: 'Olímpo',
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
      name: 'Chave de ônix',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
});

describe('collaboration sync entity handlers', () => {
  it('creates, updates, and tombstones comments and favorites owned by the current user', async () => {
    const comments = new CommentSyncHandler();
    const favorites = new FavoriteSyncHandler();
    const commentId = newId();
    const favoriteId = newId();
    await comments.create(
      userId,
      storyId,
      create('Comment', commentId, {
        entityType: 'Character',
        entityId: characterId,
        fieldId: null,
        fieldKey: 'name',
        contentSnapshot: 'Keres',
        excerptText: null,
        authorUserId: userId,
        commentText: 'Rever este nome',
        criticality: 2,
      }),
    );
    await favorites.create(
      userId,
      storyId,
      create('Favorite', favoriteId, { userId, entityId: characterId, entityType: 'Character' }),
    );

    const comment = await comments.findById(commentId);
    await comments.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Comment',
        id: commentId,
        changes: { commentText: 'Nome aprovado', version: 1 },
      } as UpdateStoryUpdate,
      comment,
    );
    expect(await comments.findById(commentId)).toMatchObject({
      commentText: 'Nome aprovado',
      version: 2,
    });
    expect(await favorites.findById(favoriteId)).toMatchObject({
      userId,
      entityId: characterId,
      isDeleted: false,
    });

    const favorite = await favorites.findById(favoriteId);
    await favorites.delete(userId, storyId, remove('Favorite', favoriteId, 1), favorite);
    const updatedComment = await comments.findById(commentId);
    await comments.delete(userId, storyId, remove('Comment', commentId, 2), updatedComment);
    expect(await favorites.findById(favoriteId)).toMatchObject({ isDeleted: true });
    expect(await comments.findById(commentId)).toMatchObject({ isDeleted: true });
  });

  it('connects a character and item state transition to an existing scene', async () => {
    const characterScenes = new CharacterSceneSyncHandler();
    const journeys = new ItemJourneySyncHandler();
    const characterSceneId = newId();
    const journeyId = newId();
    await characterScenes.create(
      userId,
      storyId,
      create('CharacterScene', characterSceneId, { characterId, sceneId }),
    );
    await expect(
      characterScenes.create(
        userId,
        storyId,
        create('CharacterScene', newId(), { characterId, sceneId }),
      ),
    ).rejects.toThrow(/already exists/i);
    await journeys.create(
      userId,
      storyId,
      create('ItemJourney', journeyId, {
        itemId,
        sceneId,
        newCharacterOwnerId: characterId,
        newState: 'ativada',
        extraNotes: null,
      }),
    );

    expect(await characterScenes.findById(characterSceneId)).toMatchObject({
      characterId,
      sceneId,
      version: 1,
    });
    expect(await journeys.findById(journeyId)).toMatchObject({
      itemId,
      sceneId,
      newCharacterOwnerId: characterId,
      newState: 'ativada',
    });

    const journey = await journeys.findById(journeyId);
    await journeys.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'ItemJourney',
        id: journeyId,
        changes: { newState: 'consumida', version: 1 },
      } as UpdateStoryUpdate,
      journey,
    );
    expect(await journeys.findById(journeyId)).toMatchObject({ newState: 'consumida', version: 2 });

    for (const [entity, id, handler, version] of [
      ['ItemJourney', journeyId, journeys, 2],
      ['CharacterScene', characterSceneId, characterScenes, 1],
    ] as const) {
      const current = await handler.findById(id);
      await handler.delete(userId, storyId, remove(entity, id, version), current);
      expect(await handler.findById(id)).toMatchObject({ isDeleted: true });
    }
  });
});
