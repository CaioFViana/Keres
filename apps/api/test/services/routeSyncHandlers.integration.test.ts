import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { choices, scenes, stories, users } from '@/db/schema';
import { RouteSyncHandler } from '@/services/entity-sync-handlers/RouteSyncHandler';
import { RouteStepSyncHandler } from '@/services/entity-sync-handlers/RouteStepSyncHandler';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

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

    await routeHandler.create(
      {
        type: 'create',
        entity: 'Route',
        id: routeId,
        data: { name: 'Train', details: null },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    const route = await routeHandler.findByIdOrThrow(routeId);
    await routeHandler.update(
      {
        type: 'update',
        entity: 'Route',
        id: routeId,
        changes: { name: 'Train ending', version: 1 },
      } as UpdateStoryUpdate,
      route,
      { userId, storyId },
    );

    await stepHandler.create(
      {
        type: 'create',
        entity: 'RouteStep',
        id: firstStepId,
        data: { routeId, position: 1, sceneId: firstSceneId, selectedChoiceId: choiceId },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    await stepHandler.create(
      {
        type: 'create',
        entity: 'RouteStep',
        id: secondStepId,
        data: { routeId, position: 2, sceneId: secondSceneId, selectedChoiceId: null },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    const secondStep = await stepHandler.findByIdOrThrow(secondStepId);
    await stepHandler.delete(
      {
        type: 'delete',
        entity: 'RouteStep',
        id: secondStepId,
        version: 1,
      } as DeleteStoryUpdate,
      secondStep,
      { userId, storyId },
    );

    expect(await routeHandler.findByIdOrThrow(routeId)).toMatchObject({
      name: 'Train ending',
      version: 2,
    });
    expect(await stepHandler.findByIdOrThrow(secondStepId)).toMatchObject({
      isDeleted: true,
      version: 2,
    });
  });

  it('rejects a step whose choice does not leave its scene', async () => {
    const routeId = newId();
    await new RouteSyncHandler().create(
      {
        type: 'create',
        entity: 'Route',
        id: routeId,
        data: { name: 'Bad path', details: null },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    await expect(
      new RouteStepSyncHandler().create(
        {
          type: 'create',
          entity: 'RouteStep',
          id: newId(),
          data: { routeId, position: 1, sceneId: secondSceneId, selectedChoiceId: choiceId },
        } as CreateStoryUpdate,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('rejects route creation when the story is not branching', async () => {
    await db.update(stories).set({ type: 'linear' }).where(eq(stories.id, storyId));
    await expect(
      new RouteSyncHandler().create(
        {
          type: 'create',
          entity: 'Route',
          id: newId(),
          data: { name: 'No route', details: null },
        } as CreateStoryUpdate,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('reports a version conflict instead of silently discarding a concurrent route edit', async () => {
    const handler = new RouteSyncHandler();
    const routeId = newId();
    await handler.create(
      {
        type: 'create',
        entity: 'Route',
        id: routeId,
        data: { name: 'Original', details: null },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    const current = await handler.findByIdOrThrow(routeId);
    await handler.update(
      {
        type: 'update',
        entity: 'Route',
        id: routeId,
        changes: { name: 'Server edit', version: 1 },
      } as UpdateStoryUpdate,
      current,
      { userId, storyId },
    );

    await expect(
      handler.update(
        {
          type: 'update',
          entity: 'Route',
          id: routeId,
          changes: { name: 'Offline edit', version: 1 },
        } as UpdateStoryUpdate,
        await handler.findByIdOrThrow(routeId),
        { userId, storyId },
      ),
    ).rejects.toMatchObject({
      reason: 'version_conflict',
      clientVersion: 1,
      serverVersion: 2,
    });
    expect(await handler.findByIdOrThrow(routeId)).toMatchObject({
      name: 'Server edit',
      version: 2,
    });
  });
});
