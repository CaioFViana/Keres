import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { scenes, stories, users } from '@/db/schema';
import { CharacterSceneSyncHandler } from '@/services/entity-sync-handlers/CharacterSceneSyncHandler';
import { CharacterSyncHandler } from '@/services/entity-sync-handlers/CharacterSyncHandler';
import { ChapterSyncHandler } from '@/services/entity-sync-handlers/ChapterSyncHandler';
import { CommentSyncHandler } from '@/services/entity-sync-handlers/CommentSyncHandler';
import { FavoriteSyncHandler } from '@/services/entity-sync-handlers/FavoriteSyncHandler';
import { ItemJourneySyncHandler } from '@/services/entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from '@/services/entity-sync-handlers/ItemSyncHandler';
import { LocationSyncHandler } from '@/services/entity-sync-handlers/LocationSyncHandler';
import { SceneSyncHandler } from '@/services/entity-sync-handlers/SceneSyncHandler';
import type { SyncEntityHandler } from '@/services/entity-sync-handlers/BaseSyncEntityHandler';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

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
    create('Chapter', chapterId, {
      name: 'Prólogo',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
  await new LocationSyncHandler().create(
    create('Location', locationId, {
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
  await new CharacterSyncHandler().create(create('Character', characterId, { name: 'Keres' }), {
    userId,
    storyId,
  });
  await new SceneSyncHandler().create(
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
    { userId, storyId },
  );
  await new ItemSyncHandler().create(
    create('Item', itemId, {
      characterOwnerId: characterId,
      name: 'Chave de ônix',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId },
  );
});

describe('collaboration sync entity handlers', () => {
  it('creates, updates, and tombstones comments and favorites owned by the current user', async () => {
    const comments = new CommentSyncHandler();
    const favorites = new FavoriteSyncHandler();
    const commentId = newId();
    const favoriteId = newId();
    await comments.create(
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
      { userId, storyId },
    );
    await favorites.create(
      create('Favorite', favoriteId, { userId, entityId: characterId, entityType: 'Character' }),
      { userId, storyId },
    );

    const comment = await comments.findByIdOrThrow(commentId);
    await comments.update(
      {
        type: 'update',
        entity: 'Comment',
        id: commentId,
        changes: { commentText: 'Nome aprovado', version: 1 },
      } as UpdateStoryUpdate,
      comment,
      { userId, storyId },
    );
    expect(await comments.findByIdOrThrow(commentId)).toMatchObject({
      commentText: 'Nome aprovado',
      version: 2,
    });
    expect(await favorites.findByIdOrThrow(favoriteId)).toMatchObject({
      userId,
      entityId: characterId,
      isDeleted: false,
    });

    const favorite = await favorites.findByIdOrThrow(favoriteId);
    await favorites.delete(remove('Favorite', favoriteId, 1), favorite, { userId, storyId });
    const updatedComment = await comments.findByIdOrThrow(commentId);
    await comments.delete(remove('Comment', commentId, 2), updatedComment, { userId, storyId });
    expect(await favorites.findByIdOrThrow(favoriteId)).toMatchObject({ isDeleted: true });
    expect(await comments.findByIdOrThrow(commentId)).toMatchObject({ isDeleted: true });
  });

  it('connects a character and item state transition to an existing scene', async () => {
    const characterScenes = new CharacterSceneSyncHandler();
    const journeys = new ItemJourneySyncHandler();
    const characterSceneId = newId();
    const journeyId = newId();
    await characterScenes.create(
      create('CharacterScene', characterSceneId, { characterId, sceneId }),
      { userId, storyId },
    );
    await expect(
      characterScenes.create(create('CharacterScene', newId(), { characterId, sceneId }), {
        userId,
        storyId,
      }),
    ).rejects.toThrow(/already exists/i);
    await journeys.create(
      create('ItemJourney', journeyId, {
        itemId,
        sceneId,
        newCharacterOwnerId: characterId,
        newState: 'ativada',
        extraNotes: null,
      }),
      { userId, storyId },
    );

    expect(await characterScenes.findByIdOrThrow(characterSceneId)).toMatchObject({
      characterId,
      sceneId,
      version: 1,
    });
    expect(await journeys.findByIdOrThrow(journeyId)).toMatchObject({
      itemId,
      sceneId,
      newCharacterOwnerId: characterId,
      newState: 'ativada',
    });

    const journey = await journeys.findByIdOrThrow(journeyId);
    await journeys.update(
      {
        type: 'update',
        entity: 'ItemJourney',
        id: journeyId,
        changes: { newState: 'consumida', version: 1 },
      } as UpdateStoryUpdate,
      journey,
      { userId, storyId },
    );
    expect(await journeys.findByIdOrThrow(journeyId)).toMatchObject({
      newState: 'consumida',
      version: 2,
    });

    const deletionCases: Array<[string, string, SyncEntityHandler, number]> = [
      ['ItemJourney', journeyId, journeys, 2],
      ['CharacterScene', characterSceneId, characterScenes, 1],
    ];
    for (const [entity, id, handler, version] of deletionCases) {
      const current = await handler.findByIdOrThrow(id);
      await handler.delete(remove(entity, id, version), current, { userId, storyId });
      expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true });
    }
  });

  it('rejects absent CharacterScene endpoints and validates a retarget before updating', async () => {
    const handler = new CharacterSceneSyncHandler();
    await expect(
      handler.create(create('CharacterScene', newId(), { characterId: newId(), sceneId }), {
        userId,
        storyId,
      }),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      handler.create(create('CharacterScene', newId(), { characterId, sceneId: newId() }), {
        userId,
        storyId,
      }),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });

    const linkId = newId();
    await handler.create(create('CharacterScene', linkId, { characterId, sceneId }), {
      userId,
      storyId,
    });
    const current = await handler.findByIdOrThrow(linkId);
    await expect(
      handler.update(
        {
          type: 'update',
          entity: 'CharacterScene',
          id: linkId,
          changes: { characterId: newId(), version: current.version },
        } as UpdateStoryUpdate,
        current,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    expect(await handler.findByIdOrThrow(linkId)).toMatchObject({
      characterId,
      sceneId,
      version: 1,
    });
  });

  it('never lets one user create, update, or delete another user’s favorite', async () => {
    const favorites = new FavoriteSyncHandler();
    const outsiderId = newId();
    const favoriteId = newId();
    await db.insert(users).values({
      id: outsiderId,
      username: 'bia',
      tag: 'bia',
      password: 'x',
    } as never);

    await expect(
      favorites.create(
        create('Favorite', newId(), {
          userId,
          entityId: characterId,
          entityType: 'Character',
        }),
        { userId: outsiderId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'unauthorized' });

    await favorites.create(
      create('Favorite', favoriteId, {
        userId,
        entityId: characterId,
        entityType: 'Character',
      }),
      { userId, storyId },
    );
    const favorite = await favorites.findByIdOrThrow(favoriteId);

    await expect(
      favorites.update(
        {
          type: 'update',
          entity: 'Favorite',
          id: favoriteId,
          changes: { version: 1 },
        } as UpdateStoryUpdate,
        favorite,
        { userId: outsiderId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
    await expect(
      favorites.delete(remove('Favorite', favoriteId, 1), favorite, {
        userId: outsiderId,
        storyId,
      }),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
    expect(await favorites.findByIdOrThrow(favoriteId)).toMatchObject({
      isDeleted: false,
      version: 1,
    });
  });

  it('keeps a favorite attached to its original user, story and entity even if its owner sends those fields', async () => {
    const favorites = new FavoriteSyncHandler();
    const favoriteId = newId();
    await favorites.create(
      create('Favorite', favoriteId, {
        userId,
        entityId: characterId,
        entityType: 'Character',
      }),
      { userId, storyId },
    );
    const current = await favorites.findByIdOrThrow(favoriteId);
    await favorites.update(
      {
        type: 'update',
        entity: 'Favorite',
        id: favoriteId,
        changes: {
          userId: newId(),
          storyId: newId(),
          entityId: newId(),
          entityType: 'Scene',
          version: current.version,
        },
      } as UpdateStoryUpdate,
      current,
      { userId, storyId },
    );
    expect(await favorites.findByIdOrThrow(favoriteId)).toMatchObject({
      userId,
      storyId,
      entityId: characterId,
      entityType: 'Character',
      version: 2,
    });
  });

  it('enforces scene references while allowing a scene to deliberately have no location', async () => {
    const scenesHandler = new SceneSyncHandler();
    const baseScene = (overrides: Record<string, unknown> = {}) => ({
      chapterId: newId(),
      locationId: null,
      name: 'Sem lugar',
      index: 2,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isStart: false,
      isFinish: false,
      isFavorite: false,
      extraNotes: null,
      ...overrides,
    });

    await expect(
      scenesHandler.create(create('Scene', newId(), baseScene()), { userId, storyId }),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      scenesHandler.create(
        create('Scene', newId(), baseScene({ chapterId: null, locationId: newId() })),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      scenesHandler.create(
        create(
          'Scene',
          newId(),
          baseScene({
            chapterId: null,
            calendarDateOverride: '0001-01-01T00:00',
            calendarDateOverrideCalendarId: newId(),
          }),
        ),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });

    const noLocationId = newId();
    await scenesHandler.create(create('Scene', noLocationId, baseScene({ chapterId: null })), {
      userId,
      storyId,
    });
    expect(await scenesHandler.findByIdOrThrow(noLocationId)).toMatchObject({ locationId: null });
  });

  /**
   * An operation writes its own row only: in a linear story the client hands the flags over, each
   * other scene's loss recorded as its own edit, so no row changes without every device learning.
   */
  it('writes the start/finish flags of the scene the operation names and no other', async () => {
    const scenesHandler = new SceneSyncHandler();
    const nextLinearId = newId();
    const sceneData = (id: string, overrides: Record<string, unknown> = {}) => ({
      chapterId: null,
      locationId: null,
      name: `Scene ${id}`,
      index: 2,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isStart: true,
      isFinish: true,
      isFavorite: false,
      extraNotes: null,
      ...overrides,
    });
    await db.update(scenes).set({ isFinish: true }).where(eq(scenes.id, sceneId));

    await scenesHandler.create(create('Scene', nextLinearId, sceneData(nextLinearId)), {
      userId,
      storyId,
    });
    expect(await scenesHandler.findByIdOrThrow(sceneId)).toMatchObject({ isFinish: true });
    expect(await scenesHandler.findByIdOrThrow(nextLinearId)).toMatchObject({
      isStart: true,
      isFinish: true,
    });

    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));
    const branchSceneId = newId();
    await scenesHandler.create(create('Scene', branchSceneId, sceneData(branchSceneId)), {
      userId,
      storyId,
    });
    expect(await scenesHandler.findByIdOrThrow(nextLinearId)).toMatchObject({
      isStart: true,
      isFinish: true,
    });
    expect(await scenesHandler.findByIdOrThrow(branchSceneId)).toMatchObject({
      isStart: true,
      isFinish: true,
    });
  });
});
