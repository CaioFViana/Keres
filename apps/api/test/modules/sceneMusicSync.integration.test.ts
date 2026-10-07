import { rankAtPosition, rankBetween } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { sceneMusic, scenes } from '../../src/db/schema';
import { SceneMusicSyncHandler } from '../../src/services/entity-sync-handlers/SceneMusicSyncHandler';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let user: TestUser;
let storyId: string;
let sceneId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: user.token, body: updates });

const musicData = (overrides: Record<string, unknown> = {}) => ({
  sceneId,
  rank: rankAtPosition(0),
  songId: null,
  galleryId: newId(),
  role: 'score',
  cue: 'comes in as she opens the door',
  sections: null,
  ...overrides,
});

const create = (id: string, data: Record<string, unknown>, operation = `create-${id}`) => ({
  type: 'create' as const,
  entity: 'SceneMusic',
  id,
  version: 0,
  clientOperationId: operation,
  data,
});

const update = (
  id: string,
  version: number,
  changes: Record<string, unknown>,
  operation: string,
) => ({
  type: 'update' as const,
  entity: 'SceneMusic',
  id,
  version,
  clientOperationId: operation,
  changes: { version, ...changes },
});

describe('the music of a scene through the sync endpoint', () => {
  beforeEach(async () => {
    await truncateAll();
    user = await registerUser('music-user');
    storyId = (await uploadTestStory(user.token, 'Music')).id;
    sceneId = newId();
    await db.insert(scenes).values({ id: sceneId, storyId, name: 'Tavern', index: 1 });
  });

  it('registers the SceneMusic protocol entity', () => {
    expect(new SceneMusicSyncHandler().entityName).toBe('SceneMusic');
  });

  it('accepts the music of a scene and keeps its target, role, cue and sections', async () => {
    const id = newId();
    const songId = newId();
    const response = await push([
      create(
        id,
        musicData({ songId, galleryId: null, role: 'in-world', sections: ['Chorus', 'Verse 2'] }),
      ),
    ]);

    expect(response.status).toBe(200);
    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) });
    expect(row).toMatchObject({
      storyId,
      sceneId,
      songId,
      galleryId: null,
      role: 'in-world',
      cue: 'comes in as she opens the door',
      sections: ['Chorus', 'Verse 2'],
      version: 1,
    });
  });

  it('retries a create without a conflict', async () => {
    const id = newId();
    const data = musicData();

    expect((await push([create(id, data)])).data.conflicts).toEqual([]);
    const retried = await push([create(id, data)]);

    expect(retried.status).toBe(200);
    expect(retried.data.conflicts).toEqual([]);
  });

  it('refuses music with no target, or with two', async () => {
    const neither = await push([create(newId(), musicData({ galleryId: null }))]);
    const both = await push([create(newId(), musicData({ songId: newId() }))]);

    expect(neither.data.applied ?? []).toEqual([]);
    expect(both.data.applied ?? []).toEqual([]);
    expect(await db.select().from(sceneMusic)).toHaveLength(0);
  });

  it('refuses a role it does not know', async () => {
    const response = await push([create(newId(), musicData({ role: 'ambient' }))]);

    expect(response.data.applied ?? []).toEqual([]);
    expect(await db.select().from(sceneMusic)).toHaveLength(0);
  });

  it('refuses music of a scene that is no longer there', async () => {
    await db.update(scenes).set({ isDeleted: true }).where(eq(scenes.id, sceneId));

    const response = await push([create(newId(), musicData())]);

    expect(response.data.applied ?? []).toEqual([]);
    expect(response.data.conflicts).toEqual([
      expect.objectContaining({ reason: 'referenced_entity_deleted' }),
    ]);
  });

  it('edits the cue and the role without touching the target', async () => {
    const id = newId();
    const data = musicData();
    await push([create(id, data)]);

    const response = await push([
      update(id, 1, { cue: 'cuts at the scream', role: 'in-world' }, 'edit-cue'),
    ]);

    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) });
    expect(row).toMatchObject({
      cue: 'cuts at the scream',
      role: 'in-world',
      galleryId: data.galleryId,
      version: 2,
    });
  });

  it('changes which sections the scene sings, and back to the whole song', async () => {
    const id = newId();
    await push([create(id, musicData({ songId: newId(), galleryId: null }))]);

    const some = await push([update(id, 1, { sections: ['Chorus'] }, 'some')]);
    expect(some.data.conflicts).toEqual([]);
    expect(
      (await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) }))?.sections,
    ).toEqual(['Chorus']);

    const all = await push([update(id, 2, { sections: null }, 'all')]);
    expect(all.data.conflicts).toEqual([]);
    expect(
      (await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) }))?.sections,
    ).toBeNull();
  });

  it('points the link at another target, a song for a gallery medium', async () => {
    const id = newId();
    await push([create(id, musicData())]);
    const songId = newId();

    const response = await push([update(id, 1, { songId, galleryId: null }, 'retarget')]);

    expect(response.data.conflicts).toEqual([]);
    const row = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) });
    expect(row).toMatchObject({ songId, galleryId: null });
  });

  it('lets the music lose its target and keep its cue, and refuses two targets at once', async () => {
    const id = newId();
    await push([create(id, musicData())]);

    const cleared = await push([update(id, 1, { galleryId: null }, 'clear-target')]);
    expect(cleared.data.conflicts).toEqual([]);

    const both = await push([
      update(id, 2, { songId: newId(), galleryId: newId() }, 'both-targets'),
    ]);
    expect(both.data.applied ?? []).toEqual([]);
    expect(both.data.conflicts).toEqual([expect.objectContaining({ reason: 'validation' })]);
    const row = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) });
    expect(row).toMatchObject({
      galleryId: null,
      songId: null,
      cue: 'comes in as she opens the door',
    });
  });

  it('reorders by moving one link: only its rank changes', async () => {
    const first = newId();
    const second = newId();
    const firstRank = rankAtPosition(0);
    const secondRank = rankAtPosition(1);
    await push([
      create(first, musicData({ rank: firstRank })),
      create(second, musicData({ rank: secondRank })),
    ]);

    const response = await push([
      update(second, 1, { rank: rankBetween(null, firstRank) }, 'move-second'),
    ]);

    expect(response.data.conflicts).toEqual([]);
    const rows = await db.select().from(sceneMusic);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[first]).toMatchObject({ rank: firstRank, version: 1 });
    expect(byId[second].rank < firstRank).toBe(true);
    expect(byId[second].version).toBe(2);
  });

  it('deletes the music of a scene', async () => {
    const id = newId();
    await push([create(id, musicData())]);

    const deleted = await push([
      {
        type: 'delete',
        entity: 'SceneMusic',
        id,
        version: 1,
        clientOperationId: 'delete-music',
        changes: { version: 1 },
      },
    ]);

    expect(deleted.data.conflicts).toEqual([]);
    const row = await db.query.sceneMusic.findFirst({ where: eq(sceneMusic.id, id) });
    expect(row?.isDeleted).toBe(true);
  });

  it('exports and imports a story with its music, remapping the scene and the target', async () => {
    await push([create(newId(), musicData({ cue: 'Kept.' }))]);

    const exported = await request('GET', `/stories/${storyId}/export`, { token: user.token });
    expect(exported.status).toBe(200);
    expect(exported.data.sceneMusic).toHaveLength(1);
    expect(exported.data.sceneMusic[0]).toMatchObject({ cue: 'Kept.', sceneId });

    const imported = await request('POST', '/stories/import', {
      token: user.token,
      body: exported.data,
    });
    expect(imported.status).toBeLessThan(300);
    const newStoryId = imported.data.id ?? imported.data.storyId;
    const copies = await db.select().from(sceneMusic).where(eq(sceneMusic.storyId, newStoryId));
    expect(copies).toHaveLength(1);
    // A new row, in a new scene, with the same note; the medium was not in the package, so the target
    // is gone and the link waits for another one instead of pointing at a stranger's row.
    expect(copies[0].sceneId).not.toBe(sceneId);
    expect(copies[0]).toMatchObject({ cue: 'Kept.', galleryId: null, songId: null });
  });
});
