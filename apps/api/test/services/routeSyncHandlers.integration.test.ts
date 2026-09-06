import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { choices, scenes, stories, users } from '../../src/db/schema';
import { RouteSyncHandler } from '../../src/services/entity-sync-handlers/RouteSyncHandler';
import { RouteStepSyncHandler } from '../../src/services/entity-sync-handlers/RouteStepSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let firstSceneId: string;
let secondSceneId: string;
let choiceId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  firstSceneId = newId();
  secondSceneId = newId();
  choiceId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'router', tag: 'router', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'Branches',
    type: 'branching',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
  await db.insert(scenes).values([
    {
      id: firstSceneId,
      storyId,
      name: 'Start',
      index: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    },
    {
      id: secondSceneId,
      storyId,
      name: 'End',
      index: 2,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    },
  ] as never);
  await db.insert(choices).values({
    id: choiceId,
    storyId,
    sceneId: firstSceneId,
    nextSceneId: secondSceneId,
    text: 'Continue',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
});

describe('Route sync handlers', () => {
  it('creates, updates and tombstones a Route and its ordered steps', async () => {
    const routeHandler = new RouteSyncHandler();
    const stepHandler = new RouteStepSyncHandler();
    const routeId = newId();
    const firstStepId = newId();
    const secondStepId = newId();

    await routeHandler.create(userId, storyId, {
      type: 'create',
      entity: 'Route',
      id: routeId,
      data: { name: 'Train', details: null },
    } as CreateStoryUpdate);
    const route = await routeHandler.findByIdOrThrow(routeId);
    await routeHandler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Route',
        id: routeId,
        changes: { name: 'Train ending', version: 1 },
      } as UpdateStoryUpdate,
      route,
    );

    await stepHandler.create(userId, storyId, {
      type: 'create',
      entity: 'RouteStep',
      id: firstStepId,
      data: { routeId, position: 1, sceneId: firstSceneId, selectedChoiceId: choiceId },
    } as CreateStoryUpdate);
    await stepHandler.create(userId, storyId, {
      type: 'create',
      entity: 'RouteStep',
      id: secondStepId,
      data: { routeId, position: 2, sceneId: secondSceneId, selectedChoiceId: null },
    } as CreateStoryUpdate);
    const secondStep = await stepHandler.findByIdOrThrow(secondStepId);
    await stepHandler.delete(
      userId,
      storyId,
      {
        type: 'delete',
        entity: 'RouteStep',
        id: secondStepId,
        version: 1,
      } as DeleteStoryUpdate,
      secondStep,
    );

    expect(await routeHandler.findByIdOrThrow(routeId)).toMatchObject({
      name: 'Train ending',
      version: 2,
    });
    expect(await stepHandler.findByIdOrThrow(secondStepId)).toMatchObject({ isDeleted: true, version: 2 });
  });

  it('rejects a step whose choice does not leave its scene', async () => {
    const routeId = newId();
    await new RouteSyncHandler().create(userId, storyId, {
      type: 'create',
      entity: 'Route',
      id: routeId,
      data: { name: 'Bad path', details: null },
    } as CreateStoryUpdate);
    await expect(
      new RouteStepSyncHandler().create(userId, storyId, {
        type: 'create',
        entity: 'RouteStep',
        id: newId(),
        data: { routeId, position: 1, sceneId: secondSceneId, selectedChoiceId: choiceId },
      } as CreateStoryUpdate),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('rejects route creation when the story is not branching', async () => {
    await db.update(stories).set({ type: 'linear' }).where(eq(stories.id, storyId));
    await expect(
      new RouteSyncHandler().create(userId, storyId, {
        type: 'create',
        entity: 'Route',
        id: newId(),
        data: { name: 'No route', details: null },
      } as CreateStoryUpdate),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('reports a version conflict instead of silently discarding a concurrent route edit', async () => {
    const handler = new RouteSyncHandler();
    const routeId = newId();
    await handler.create(userId, storyId, {
      type: 'create',
      entity: 'Route',
      id: routeId,
      data: { name: 'Original', details: null },
    } as CreateStoryUpdate);
    const current = await handler.findByIdOrThrow(routeId);
    await handler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'Route',
        id: routeId,
        changes: { name: 'Server edit', version: 1 },
      } as UpdateStoryUpdate,
      current,
    );

    await expect(
      handler.update(
        userId,
        storyId,
        {
          type: 'update',
          entity: 'Route',
          id: routeId,
          changes: { name: 'Offline edit', version: 1 },
        } as UpdateStoryUpdate,
        await handler.findByIdOrThrow(routeId),
      ),
    ).rejects.toMatchObject({
      reason: 'version_conflict',
      clientVersion: 1,
      serverVersion: 2,
    });
    expect(await handler.findByIdOrThrow(routeId)).toMatchObject({ name: 'Server edit', version: 2 });
  });
});
