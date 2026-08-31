import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { chapters, locations, plots, scenes, stories, users } from '../../src/db/schema';
import { PlotSceneSyncHandler } from '../../src/services/entity-sync-handlers/PlotSceneSyncHandler';
import { PlotSyncHandler } from '../../src/services/entity-sync-handlers/PlotSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let plotId: string;
let sceneId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  plotId = newId();
  sceneId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'plotter', tag: 'plotter', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'Linear story',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
  const chapterId = newId();
  const locationId = newId();
  await db.insert(chapters).values({
    id: chapterId,
    storyId,
    name: 'Chapter',
    index: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
  await db.insert(locations).values({
    id: locationId,
    storyId,
    name: 'Location',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
  await db.insert(scenes).values({
    id: sceneId,
    storyId,
    chapterId,
    locationId,
    name: 'Scene',
    index: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
  await new PlotSyncHandler().create(userId, storyId, {
    type: 'create',
    entity: 'Plot',
    id: plotId,
    data: { name: 'Main plot', details: null },
  } as CreateStoryUpdate);
});

describe('PlotSceneSyncHandler', () => {
  it('creates, updates, and tombstones a plot-scene note', async () => {
    const handler = new PlotSceneSyncHandler();
    const id = newId();
    await handler.create(userId, storyId, {
      type: 'create',
      entity: 'PlotScene',
      id,
      data: { plotId, sceneId, note: 'The plot advances.' },
    } as CreateStoryUpdate);
    const created = await handler.findById(id);

    await handler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'PlotScene',
        id,
        changes: { note: 'The plot turns.', version: 1 },
      } as UpdateStoryUpdate,
      created,
    );
    const updated = await handler.findById(id);
    await handler.delete(
      userId,
      storyId,
      { type: 'delete', entity: 'PlotScene', id, version: 2 } as DeleteStoryUpdate,
      updated,
    );

    expect(await handler.findById(id)).toMatchObject({
      note: 'The plot turns.',
      version: 3,
      isDeleted: true,
    });
  });

  it('rejects a second live relation for the same plot and scene', async () => {
    const handler = new PlotSceneSyncHandler();
    const data = { plotId, sceneId, note: 'First' };
    await handler.create(userId, storyId, {
      type: 'create',
      entity: 'PlotScene',
      id: newId(),
      data,
    } as CreateStoryUpdate);

    await expect(
      handler.create(userId, storyId, {
        type: 'create',
        entity: 'PlotScene',
        id: newId(),
        data: { ...data, note: 'Duplicate' },
      } as CreateStoryUpdate),
    ).rejects.toThrow(/already part of the plot/i);
  });

  it('reports a deleted or cross-story dependency as a resolvable sync conflict', async () => {
    await db.update(plots).set({ isDeleted: true }).where(eq(plots.id, plotId));

    const attempt = new PlotSceneSyncHandler().create(userId, storyId, {
      type: 'create',
      entity: 'PlotScene',
      id: newId(),
      data: { plotId, sceneId, note: 'Missing plot' },
    } as CreateStoryUpdate);

    await expect(attempt).rejects.toMatchObject({
      reason: 'referenced_entity_deleted',
    });
  });
});

describe('plot story constraints', () => {
  it('rejects plot writes after the story becomes branching', async () => {
    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));

    const attempt = new PlotSyncHandler().create(userId, storyId, {
      type: 'create',
      entity: 'Plot',
      id: newId(),
      data: { name: 'Invalid plot', details: null },
    } as CreateStoryUpdate);

    await expect(attempt).rejects.toMatchObject({
      reason: 'validation',
    });
  });

  it('rejects stale plot-scene writes after the story becomes branching', async () => {
    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));

    const attempt = new PlotSceneSyncHandler().create(userId, storyId, {
      type: 'create',
      entity: 'PlotScene',
      id: newId(),
      data: { plotId, sceneId, note: 'Stale linear relation' },
    } as CreateStoryUpdate);

    await expect(attempt).rejects.toMatchObject({ reason: 'validation' });
  });
});
