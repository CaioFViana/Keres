import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { chapters, locations, plots, scenes, stories, users } from '@/db/schema';
import { PlotSceneSyncHandler } from '@/services/entity-sync-handlers/PlotSceneSyncHandler';
import { PlotSyncHandler } from '@/services/entity-sync-handlers/PlotSyncHandler';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

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
  await new PlotSyncHandler().create(
    {
      type: 'create',
      entity: 'Plot',
      id: plotId,
      data: { name: 'Main plot', details: null },
    } as CreateStoryUpdate,
    { userId, storyId },
  );
});

describe('PlotSceneSyncHandler', () => {
  it('creates, updates, and tombstones a plot-scene note', async () => {
    const handler = new PlotSceneSyncHandler();
    const id = newId();
    await handler.create(
      {
        type: 'create',
        entity: 'PlotScene',
        id,
        data: { plotId, sceneId, note: 'The plot advances.' },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    const created = await handler.findByIdOrThrow(id);

    await handler.update(
      {
        type: 'update',
        entity: 'PlotScene',
        id,
        changes: { note: 'The plot turns.', version: 1 },
      } as UpdateStoryUpdate,
      created,
      { userId, storyId },
    );
    const updated = await handler.findByIdOrThrow(id);
    await handler.delete(
      { type: 'delete', entity: 'PlotScene', id, version: 2 } as DeleteStoryUpdate,
      updated,
      { userId, storyId },
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      note: 'The plot turns.',
      version: 3,
      isDeleted: true,
    });
  });

  it('rejects a second live relation for the same plot and scene', async () => {
    const handler = new PlotSceneSyncHandler();
    const data = { plotId, sceneId, note: 'First' };
    await handler.create(
      {
        type: 'create',
        entity: 'PlotScene',
        id: newId(),
        data,
      } as CreateStoryUpdate,
      { userId, storyId },
    );

    await expect(
      handler.create(
        {
          type: 'create',
          entity: 'PlotScene',
          id: newId(),
          data: { ...data, note: 'Duplicate' },
        } as CreateStoryUpdate,
        { userId, storyId },
      ),
    ).rejects.toThrow(/already part of the plot/i);
  });

  it('reports a deleted or cross-story dependency as a resolvable sync conflict', async () => {
    await db.update(plots).set({ isDeleted: true }).where(eq(plots.id, plotId));

    const attempt = new PlotSceneSyncHandler().create(
      {
        type: 'create',
        entity: 'PlotScene',
        id: newId(),
        data: { plotId, sceneId, note: 'Missing plot' },
      } as CreateStoryUpdate,
      { userId, storyId },
    );

    await expect(attempt).rejects.toMatchObject({
      reason: 'referenced_entity_deleted',
    });
  });

  it('validates both dependencies again when a stale update or delete arrives', async () => {
    const handler = new PlotSceneSyncHandler();
    const id = newId();
    await handler.create(
      {
        type: 'create',
        entity: 'PlotScene',
        id,
        data: { plotId, sceneId, note: 'Antes' },
      } as CreateStoryUpdate,
      { userId, storyId },
    );
    const current = await handler.findByIdOrThrow(id);
    await db
      .update(scenes)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(scenes.id, sceneId));

    await expect(
      handler.update(
        {
          type: 'update',
          entity: 'PlotScene',
          id,
          changes: { note: 'Tarde', version: 1 },
        } as UpdateStoryUpdate,
        current,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      handler.delete(
        { type: 'delete', entity: 'PlotScene', id, version: 1 } as DeleteStoryUpdate,
        current,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });
});

describe('plot story constraints', () => {
  it('rejects plot writes after the story becomes branching', async () => {
    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));

    const attempt = new PlotSyncHandler().create(
      {
        type: 'create',
        entity: 'Plot',
        id: newId(),
        data: { name: 'Invalid plot', details: null },
      } as CreateStoryUpdate,
      { userId, storyId },
    );

    await expect(attempt).rejects.toMatchObject({
      reason: 'validation',
    });
  });

  it('rejects stale plot-scene writes after the story becomes branching', async () => {
    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));

    const attempt = new PlotSceneSyncHandler().create(
      {
        type: 'create',
        entity: 'PlotScene',
        id: newId(),
        data: { plotId, sceneId, note: 'Stale linear relation' },
      } as CreateStoryUpdate,
      { userId, storyId },
    );

    await expect(attempt).rejects.toMatchObject({ reason: 'validation' });
  });

  it('rejects update and deletion of an existing plot after conversion to branching', async () => {
    const handler = new PlotSyncHandler();
    const current = await handler.findByIdOrThrow(plotId);
    await db.update(stories).set({ type: 'branching' }).where(eq(stories.id, storyId));

    await expect(
      handler.update(
        {
          type: 'update',
          entity: 'Plot',
          id: plotId,
          changes: { name: 'Tarde', version: 1 },
        } as UpdateStoryUpdate,
        current,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
    await expect(
      handler.delete(
        { type: 'delete', entity: 'Plot', id: plotId, version: 1 } as DeleteStoryUpdate,
        current,
        { userId, storyId },
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
  });
});
