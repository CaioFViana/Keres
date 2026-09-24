import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, characters, scenes, stats, stories } from '../../src/db/schema';
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
    // The tombstoned delete reports 0: no log row holds it now, and any fresher number
    // would belong to somebody else's operation.
    expect(
      second.data.applied.find(
        (entry: { clientOperationId?: string }) =>
          entry.clientOperationId === `local-${charB}-delete`,
      ).operationVersion,
    ).toBe(0);
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
    expect(retry.data.applied[0].operationVersion).toBe(0);
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
    // History holds this op's own application, so the resend reports that row's version -
    // the client's echo check keys on it and skips the row cleanly on the next pull.
    expect(second.data.applied[0].operationVersion).toBe(first.data.applied[0].operationVersion);
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

  it('refuses an empty reorder as malformed instead of logging a row nobody can apply', async () => {
    const chapterId = newId();
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
    const before = (await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion;

    // Fresh base and stale base alike: emptiness is refused before any resend comparison,
    // so it can never slip through as a vacuous no-op either.
    for (const version of [1, 0]) {
      const refused = await push(ana.token, storyId, [
        {
          type: 'reorder' as const,
          entity: 'Chapter',
          id: chapterId,
          version,
          reorderItems: [],
          clientOperationId: `chapter-reorder-empty-${version}`,
        },
      ]);
      expect(refused.data.applied).toHaveLength(0);
      expect(refused.data.conflicts).toHaveLength(1);
      expect(refused.data.conflicts[0]).toMatchObject({ reason: 'validation' });
    }

    expect((await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion).toBe(before);
    const chapterRow = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
    expect(chapterRow?.version).toBe(1);
  });

  it('resends a chained reorder batch idempotently at the original versions', async () => {
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
    // Two chained reorders: R1 swaps, R2 swaps back. Each rests on the version bump the
    // previous application produced.
    const batch = [
      {
        type: 'reorder' as const,
        entity: 'Chapter',
        id: chapterId,
        version: 1,
        reorderItems: [
          { id: sceneA, newIndex: 2 },
          { id: sceneB, newIndex: 1 },
        ],
        clientOperationId: 'chapter-reorder-1',
      },
      {
        type: 'reorder' as const,
        entity: 'Chapter',
        id: chapterId,
        version: 2,
        reorderItems: [
          { id: sceneA, newIndex: 1 },
          { id: sceneB, newIndex: 2 },
        ],
        clientOperationId: 'chapter-reorder-2',
      },
    ];
    const first = await push(ana.token, storyId, batch);
    expect(first.data.conflicts).toEqual([]);
    const originalVersions = first.data.applied.map(
      (entry: { operationVersion: number }) => entry.operationVersion,
    );

    // The response is lost and the identical batch is resent. R1's arrangement no longer
    // holds live (R2 superseded it), so the live-row comparison cannot recognise it - but
    // history holds R1's own application past its base, which proves it already landed.
    // Neither op conflicts, and neither blocks its sibling.
    const second = await push(ana.token, storyId, batch);

    expect(second.data.conflicts).toEqual([]);
    expect(second.data.applied).toHaveLength(2);
    expect(
      second.data.applied.map((entry: { operationVersion: number }) => entry.operationVersion),
    ).toEqual(originalVersions);
    expect(second.data.applied.every((entry: { operationId?: string }) => !entry.operationId)).toBe(
      true,
    );
    expect(second.data.serverMaxOperationVersion).toBe(first.data.serverMaxOperationVersion);

    const chapterRow = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
    expect(chapterRow?.version).toBe(3);
    const sceneRows = await db.query.scenes.findMany({ where: eq(scenes.chapterId, chapterId) });
    expect(sceneRows.find((row) => row.id === sceneA)).toMatchObject({ index: 1 });
    expect(sceneRows.find((row) => row.id === sceneB)).toMatchObject({ index: 2 });
  });

  it('reports 0 when the arrangement holds live without any logged twin', async () => {
    // The rows already sit at the wanted arrangement, but no reorder row ever logged it
    // (the order came from outside sync). The live comparison still recognises the resend -
    // and with no row holding the effect, 0 is the only honest version to report.
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
        version: 2,
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
    const before = (await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion;

    const resend = await push(ana.token, storyId, [
      {
        type: 'reorder' as const,
        entity: 'Chapter',
        id: chapterId,
        version: 1,
        reorderItems: [
          { id: sceneA, newIndex: 1 },
          { id: sceneB, newIndex: 2 },
        ],
        clientOperationId: 'chapter-reorder-twinless',
      },
    ]);

    expect(resend.data.conflicts).toEqual([]);
    expect(resend.data.applied).toHaveLength(1);
    expect(resend.data.applied[0].operationVersion).toBe(0);
    expect(resend.data.serverMaxOperationVersion).toBe(before);
  });

  it('resends an applied stat reorder idempotently across the 0-based order mapping', async () => {
    // Stats persist 0-based `order` while the wire speaks 1-based `newIndex`: the resend
    // comparison must mirror the write mapping, or every stat resend false-conflicts.
    const statA = newId();
    const statB = newId();
    const now = new Date();
    await db.insert(stats).values([
      {
        id: statA,
        storyId,
        name: 'A',
        order: 0,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      },
      {
        id: statB,
        storyId,
        name: 'B',
        order: 1,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      },
    ] as never);
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    const base = story!.version;
    const reorder = {
      type: 'reorder' as const,
      entity: 'Story',
      id: storyId,
      version: base,
      reorderTarget: 'Stat' as const,
      reorderItems: [
        { id: statA, newIndex: 2 },
        { id: statB, newIndex: 1 },
      ],
      clientOperationId: 'stat-reorder',
    };
    const first = await push(ana.token, storyId, [reorder]);
    expect(first.data.conflicts).toEqual([]);

    const second = await push(ana.token, storyId, [reorder]);

    expect(second.data.conflicts).toEqual([]);
    expect(second.data.applied).toHaveLength(1);
    expect(second.data.applied[0].operationId).toBeUndefined();
    expect(second.data.serverMaxOperationVersion).toBe(first.data.serverMaxOperationVersion);

    const storyRow = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(storyRow?.version).toBe(base + 1);
    const statRows = await db.query.stats.findMany({ where: eq(stats.storyId, storyId) });
    expect(statRows.find((row) => row.id === statA)).toMatchObject({ order: 1, version: 2 });
    expect(statRows.find((row) => row.id === statB)).toMatchObject({ order: 0, version: 2 });
  });

  it('keys an X-Y-X resend on the oldest twin so the later twin still applies', async () => {
    // X lands, Y intervenes, X lands again; then the first X's response-less resend arrives
    // with its stale base. The client absorbs exactly the reported version as its echo and
    // applies everything else: reporting the newest X would absorb it while applying the
    // older X and the Y in between, stranding the client on Y while the server holds X.
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
    const arrangementX = [
      { id: sceneA, newIndex: 2 },
      { id: sceneB, newIndex: 1 },
    ];
    const arrangementY = [
      { id: sceneA, newIndex: 1 },
      { id: sceneB, newIndex: 2 },
    ];
    const reorder = (items: { id: string; newIndex: number }[], base: number, tag: string) => ({
      type: 'reorder' as const,
      entity: 'Chapter',
      id: chapterId,
      version: base,
      reorderItems: items,
      clientOperationId: `chapter-reorder-${tag}`,
    });

    const firstX = await push(ana.token, storyId, [reorder(arrangementX, 1, 'x-1')]);
    expect(firstX.data.conflicts).toEqual([]);
    const oldestTwin = firstX.data.applied[0].operationVersion;
    const middleY = await push(ana.token, storyId, [reorder(arrangementY, 2, 'y')]);
    expect(middleY.data.conflicts).toEqual([]);
    const newestX = await push(ana.token, storyId, [reorder(arrangementX, 3, 'x-2')]);
    expect(newestX.data.conflicts).toEqual([]);
    expect(newestX.data.applied[0].operationVersion).not.toBe(oldestTwin);

    // The first X's push response was lost, so the arrangement comes back with base 1
    // under a fresh id: only the history comparison can recognise it, not id dedup.
    const resend = await push(ana.token, storyId, [reorder(arrangementX, 1, 'x-1-retry')]);

    expect(resend.data.conflicts).toEqual([]);
    expect(resend.data.applied).toHaveLength(1);
    expect(resend.data.applied[0].operationId).toBeUndefined();
    expect(resend.data.applied[0].operationVersion).toBe(oldestTwin);
    expect(resend.data.serverMaxOperationVersion).toBe(newestX.data.serverMaxOperationVersion);
  });
});
