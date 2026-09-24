import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, characters, scenes } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const pull = (token: string, story: string, lastOperationVersion = 0) =>
  request('GET', `/sync/${story}/pull`, {
    token,
    query: { lastOperationVersion, lastPublicFavoriteVersion: 0 },
  });

/** A character-create operation, the simplest way to write something through sync. */
const createCharacter = (id: string, name: string, version = 0) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version,
  data: { id, storyId, name },
  clientOperationId: `local-${id}`,
});

const updateCharacter = (id: string, name: string, baseVersion: number) => ({
  type: 'update' as const,
  entity: 'Character',
  id,
  version: baseVersion,
  changes: { name, version: baseVersion },
  clientOperationId: `local-${id}-rename`,
});

const deleteCharacter = (id: string, baseVersion: number) => ({
  type: 'delete' as const,
  entity: 'Character',
  id,
  version: baseVersion,
  clientOperationId: `local-${id}-delete`,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('resuming a batch whose response was lost', () => {
  it('replays a whole mixed batch idempotently, without duplicating or advancing versions', async () => {
    const charA = newId();
    const charB = newId();
    const batch = [
      createCharacter(charA, 'Aria'),
      createCharacter(charB, 'Bram'),
      updateCharacter(charA, 'Aria Stark', 1),
      deleteCharacter(charB, 1),
    ];
    const before = (await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion;

    const first = await push(ana.token, storyId, batch);
    expect(first.status).toBe(200);
    expect(first.data.conflicts).toEqual([]);
    // The response never arrives: the client keeps every operation pending and sends the
    // identical batch again on the next cycle.
    const second = await push(ana.token, storyId, batch);

    expect(second.status).toBe(200);
    expect(second.data.processedUpdates).toBe(4);
    // Creates and the tombstoned delete come back as already applied, without new log rows;
    // the update cannot be proven a resend by versions alone, so it conflicts carrying the
    // changed-fields evidence the client needs to merge it silently.
    expect(second.data.applied).toHaveLength(3);
    expect(second.data.applied.every((entry: { operationId?: string }) => !entry.operationId)).toBe(
      true,
    );
    expect(second.data.conflicts).toHaveLength(1);
    expect(second.data.conflicts[0]).toMatchObject({
      entity: 'Character',
      entityId: charA,
      reason: 'version_conflict',
    });
    expect(second.data.conflicts[0].changedFields).toEqual(expect.arrayContaining(['name']));
    expect(second.data.serverMaxOperationVersion).toBe(first.data.serverMaxOperationVersion);

    const rows = await db.query.characters.findMany({ where: eq(characters.storyId, storyId) });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === charA)).toMatchObject({
      name: 'Aria Stark',
      version: 2,
      isDeleted: false,
    });
    expect(rows.find((row) => row.id === charB)).toMatchObject({ isDeleted: true });

    const replay = await pull(ana.token, storyId, before);
    expect(replay.data.updates).toHaveLength(4);
    expect(
      new Set(replay.data.updates.map((op: { operationId: string }) => op.operationId)).size,
    ).toBe(4);
  });

  it('reports a resent create at its original version, never at the current maximum', async () => {
    // The client marks its op with the reported version and later skips any pulled op at
    // that version as its own echo. Reporting the max here would mask whatever operation
    // actually sits there - a concurrent op skipped forever. This locks the true version.
    const charX = newId();
    const first = await push(ana.token, storyId, [createCharacter(charX, 'X')]);
    const originalVersion = first.data.applied[0].operationVersion;
    await push(ana.token, storyId, [createCharacter(newId(), 'Concurrent')]);

    const resend = await push(ana.token, storyId, [createCharacter(charX, 'X')]);

    expect(resend.data.conflicts).toEqual([]);
    expect(resend.data.applied).toHaveLength(1);
    expect(resend.data.applied[0].operationVersion).toBe(originalVersion);
    expect(resend.data.applied[0].operationVersion).toBeLessThan(
      resend.data.serverMaxOperationVersion,
    );
  });

  it('reports a retried tombstone as success without appending history', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const deleted = await push(ana.token, storyId, [deleteCharacter(characterId, 1)]);

    const retry = await push(ana.token, storyId, [deleteCharacter(characterId, 1)]);

    expect(retry.data.conflicts).toEqual([]);
    expect(retry.data.applied).toHaveLength(1);
    expect(retry.data.applied[0].operationId).toBeUndefined();
    expect(retry.data.serverMaxOperationVersion).toBe(deleted.data.serverMaxOperationVersion);

    const row = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
  });
});

describe('concurrent updates from the same base', () => {
  it('applies exactly one and conflicts the other, never losing an update', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const base = created.data.applied[0].entityVersion;

    const [left, right] = await Promise.all([
      push(ana.token, storyId, [updateCharacter(characterId, 'Left', base)]),
      push(ana.token, storyId, [updateCharacter(characterId, 'Right', base)]),
    ]);

    const applied = [...left.data.applied, ...right.data.applied];
    const conflicts = [...left.data.conflicts, ...right.data.conflicts];
    expect(applied).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ reason: 'version_conflict', entityId: characterId });

    const row = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
    expect(['Left', 'Right']).toContain(row?.name);
    expect(row?.version).toBe(2);
  });
});

describe('resending an applied reorder', () => {
  it('succeeds without moving versions, rows, or the log', async () => {
    const chapterId = newId();
    const sceneA = newId();
    const sceneB = newId();
    const now = new Date();
    await db.insert(chapters).values([
      {
        id: chapterId,
        storyId,
        name: 'Um',
        index: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ] as never);
    await db.insert(scenes).values([
      {
        id: sceneA,
        storyId,
        chapterId,
        name: 'Cena um',
        index: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: sceneB,
        storyId,
        chapterId,
        name: 'Cena dois',
        index: 2,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ] as never);
    const reorder = {
      type: 'reorder' as const,
      entity: 'Chapter',
      id: chapterId,
      version: 1,
      reorderItems: [
        { id: sceneA, newIndex: 2 },
        { id: sceneB, newIndex: 1 },
      ],
      clientOperationId: 'chapter-reorder',
    };
    const first = await push(ana.token, storyId, [reorder]);
    expect(first.data.conflicts).toEqual([]);

    const second = await push(ana.token, storyId, [reorder]);

    expect(second.data.conflicts).toEqual([]);
    expect(second.data.applied).toHaveLength(1);
    expect(second.data.applied[0].operationId).toBeUndefined();
    expect(second.data.serverMaxOperationVersion).toBe(first.data.serverMaxOperationVersion);

    const chapterRow = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
    expect(chapterRow?.version).toBe(2);
    const sceneRows = await db.query.scenes.findMany({ where: eq(scenes.chapterId, chapterId) });
    expect(sceneRows.find((row) => row.id === sceneA)).toMatchObject({ index: 2, version: 2 });
    expect(sceneRows.find((row) => row.id === sceneB)).toMatchObject({ index: 1, version: 2 });
  });

  it('refuses a stale reorder whose items duplicate an id instead of restating the order', async () => {
    const chapterId = newId();
    const sceneA = newId();
    const sceneB = newId();
    const now = new Date();
    await db.insert(chapters).values([
      {
        id: chapterId,
        storyId,
        name: 'Um',
        index: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ] as never);
    await db.insert(scenes).values(
      [
        { id: sceneA, index: 1 },
        { id: sceneB, index: 2 },
      ].map((scene) => ({
        ...scene,
        storyId,
        chapterId,
        name: scene.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      })),
    );
    const applied = await push(ana.token, storyId, [
      {
        type: 'reorder' as const,
        entity: 'Chapter',
        id: chapterId,
        version: 1,
        reorderItems: [
          { id: sceneA, newIndex: 2 },
          { id: sceneB, newIndex: 1 },
        ],
        clientOperationId: 'chapter-reorder',
      },
    ]);
    expect(applied.data.conflicts).toEqual([]);

    // Same length as the live set, but one id twice and one missing: matching it one
    // entry at a time would wrongly call it "already applied". It must fall through to
    // the version check and conflict like any other stale divergent reorder.
    const malformed = await push(ana.token, storyId, [
      {
        type: 'reorder' as const,
        entity: 'Chapter',
        id: chapterId,
        version: 1,
        reorderItems: [
          { id: sceneA, newIndex: 2 },
          { id: sceneA, newIndex: 2 },
        ],
        clientOperationId: 'chapter-reorder-dupe',
      },
    ]);

    expect(malformed.data.applied).toHaveLength(0);
    expect(malformed.data.conflicts).toHaveLength(1);
    expect(malformed.data.conflicts[0]).toMatchObject({ reason: 'version_conflict' });
  });
});
