import { rankAtPosition, rankBetween } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { scenePages, scenes } from '../../src/db/schema';
import { ScenePageSyncHandler } from '../../src/services/entity-sync-handlers/ScenePageSyncHandler';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let user: TestUser;
let storyId: string;
let sceneId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: user.token, body: updates });

const pageData = (overrides: Record<string, unknown> = {}) => ({
  sceneId,
  rank: rankAtPosition(0),
  sketchId: null,
  galleryId: newId(),
  fit: 'contain',
  text: 'Panel 1: she waits.',
  ...overrides,
});

const create = (id: string, data: Record<string, unknown>, operation = `create-${id}`) => ({
  type: 'create' as const,
  entity: 'ScenePage',
  id,
  version: 0,
  clientOperationId: operation,
  data,
});

describe('scene pages through the sync endpoint', () => {
  beforeEach(async () => {
    await truncateAll();
    user = await registerUser('page-user');
    storyId = (await uploadTestStory(user.token, 'Pages')).id;
    sceneId = newId();
    await db.insert(scenes).values({ id: sceneId, storyId, name: 'Opening', index: 1 });
  });

  it('registers the ScenePage protocol entity', () => {
    expect(new ScenePageSyncHandler().entityName).toBe('ScenePage');
  });

  it('accepts a page of a scene and keeps its text, image and fit', async () => {
    const id = newId();
    const response = await push([create(id, pageData({ fit: 'cover' }))]);

    expect(response.status).toBe(200);
    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.scenePages.findFirst({ where: eq(scenePages.id, id) });
    expect(row).toMatchObject({
      storyId,
      sceneId,
      fit: 'cover',
      text: 'Panel 1: she waits.',
      sketchId: null,
      version: 1,
    });
  });

  it('retries a create without a conflict', async () => {
    const id = newId();
    const data = pageData();

    expect((await push([create(id, data)])).data.conflicts).toEqual([]);
    const retried = await push([create(id, data)]);

    expect(retried.status).toBe(200);
    expect(retried.data.conflicts).toEqual([]);
  });

  it('refuses a page with no image, or with two', async () => {
    const neither = await push([create(newId(), pageData({ galleryId: null }))]);
    const both = await push([create(newId(), pageData({ sketchId: newId() }))]);

    expect(neither.data.applied ?? []).toEqual([]);
    expect(both.data.applied ?? []).toEqual([]);
    expect(await db.select().from(scenePages)).toHaveLength(0);
  });

  it('refuses a page of a scene that is no longer there', async () => {
    await db.update(scenes).set({ isDeleted: true }).where(eq(scenes.id, sceneId));

    const response = await push([create(newId(), pageData())]);

    expect(response.data.applied ?? []).toEqual([]);
    expect(response.data.conflicts).toEqual([
      expect.objectContaining({ reason: 'referenced_entity_deleted' }),
    ]);
  });

  it('edits the text of a page without touching its image', async () => {
    const id = newId();
    const data = pageData();
    await push([create(id, data)]);

    const response = await push([
      {
        type: 'update',
        entity: 'ScenePage',
        id,
        version: 1,
        clientOperationId: 'edit-text',
        changes: { version: 1, text: 'Panel 1: she waits, and listens.' },
      },
    ]);

    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.scenePages.findFirst({ where: eq(scenePages.id, id) });
    expect(row).toMatchObject({
      text: 'Panel 1: she waits, and listens.',
      galleryId: data.galleryId,
      fit: 'contain',
      version: 2,
    });
  });

  it('puts another image in place of one, a sketch for a gallery medium', async () => {
    const id = newId();
    await push([create(id, pageData())]);
    const sketchId = newId();

    const response = await push([
      {
        type: 'update',
        entity: 'ScenePage',
        id,
        version: 1,
        clientOperationId: 'replace-image',
        changes: { version: 1, sketchId, galleryId: null },
      },
    ]);

    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.scenePages.findFirst({ where: eq(scenePages.id, id) });
    expect(row).toMatchObject({ sketchId, galleryId: null });
  });

  it('lets a page lose its image and keep its text, and refuses two images at once', async () => {
    const id = newId();
    await push([create(id, pageData())]);

    const cleared = await push([
      {
        type: 'update',
        entity: 'ScenePage',
        id,
        version: 1,
        clientOperationId: 'clear-image',
        changes: { version: 1, galleryId: null },
      },
    ]);
    expect(cleared.data.conflicts).toEqual([]);

    const both = await push([
      {
        type: 'update',
        entity: 'ScenePage',
        id,
        version: 2,
        clientOperationId: 'both-images',
        changes: { version: 2, sketchId: newId(), galleryId: newId() },
      },
    ]);
    expect(both.data.applied ?? []).toEqual([]);
    expect(both.data.conflicts).toEqual([expect.objectContaining({ reason: 'validation' })]);
    const row = await db.query.scenePages.findFirst({ where: eq(scenePages.id, id) });
    expect(row).toMatchObject({ galleryId: null, sketchId: null, text: 'Panel 1: she waits.' });
  });

  it('reorders by moving one page: only its rank changes', async () => {
    const first = newId();
    const second = newId();
    const firstRank = rankAtPosition(0);
    const secondRank = rankAtPosition(1);
    await push([
      create(first, pageData({ rank: firstRank })),
      create(second, pageData({ rank: secondRank })),
    ]);

    const response = await push([
      {
        type: 'update',
        entity: 'ScenePage',
        id: second,
        version: 1,
        clientOperationId: 'move-second',
        changes: { version: 1, rank: rankBetween(null, firstRank) },
      },
    ]);

    expect(response.data.conflicts).toEqual([]);
    const rows = await db.select().from(scenePages);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[first]).toMatchObject({ rank: firstRank, version: 1 });
    expect(byId[second].rank < firstRank).toBe(true);
    expect(byId[second].version).toBe(2);
  });

  it('deletes a page', async () => {
    const id = newId();
    await push([create(id, pageData())]);

    const deleted = await push([
      {
        type: 'delete',
        entity: 'ScenePage',
        id,
        version: 1,
        clientOperationId: 'delete-page',
        changes: { version: 1 },
      },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    const row = await db.query.scenePages.findFirst({ where: eq(scenePages.id, id) });
    expect(row?.isDeleted).toBe(true);
  });

  it('exports and imports a story with its pages, remapping the scene and the images', async () => {
    const sketchless = newId();
    await push([create(sketchless, pageData({ text: 'Kept.' }))]);

    const exported = await request('GET', `/stories/${storyId}/export`, { token: user.token });
    expect(exported.status).toBe(200);
    expect(exported.data.scenePages).toHaveLength(1);
    expect(exported.data.scenePages[0]).toMatchObject({ text: 'Kept.', sceneId });

    const imported = await request('POST', '/stories/import', {
      token: user.token,
      body: exported.data,
    });
    expect(imported.status).toBeLessThan(300);
    const newStoryId = imported.data.id ?? imported.data.storyId;
    const copies = await db.select().from(scenePages).where(eq(scenePages.storyId, newStoryId));
    expect(copies).toHaveLength(1);
    // A new row, in a new scene, with the same words; the image was not in the package, so it is gone
    // and the page waits for another one instead of pointing at a stranger's row.
    expect(copies[0].id).not.toBe(sketchless);
    expect(copies[0].sceneId).not.toBe(sceneId);
    expect(copies[0]).toMatchObject({ text: 'Kept.', galleryId: null, sketchId: null });
  });
});
