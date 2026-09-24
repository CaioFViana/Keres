import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { characters } from '../../src/db/schema';
import { compactStoryUpdateHistory } from '../../src/services/sync/SyncHistoryCompaction';
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

const createCharacter = (id: string, name: string) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version: 0,
  data: { id, storyId, name },
  clientOperationId: `local-${id}`,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('two devices sharing one story', () => {
  it('exchanges every operation through pull until both cursors rest on the same truth', async () => {
    const charX = newId();
    const charY = newId();
    const before = (await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion;

    // Device A writes while B is offline.
    const pushed = await push(ana.token, storyId, [
      createCharacter(charX, 'X'),
      {
        type: 'update',
        entity: 'Character',
        id: charX,
        version: 1,
        changes: { name: 'X2', version: 1 },
        clientOperationId: `local-${charX}-rename`,
      },
      createCharacter(charY, 'Y'),
    ]);
    expect(pushed.data.conflicts).toEqual([]);

    // Device B pulls everything it missed, in version order.
    const bFirst = await pull(ana.token, storyId, before);
    expect(bFirst.data.updates.map((op: { type: string }) => op.type)).toEqual([
      'create',
      'update',
      'create',
    ]);
    const bCursor = Math.max(
      ...bFirst.data.updates.map((op: { operationVersion: number }) => op.operationVersion),
    );
    const yBase = bFirst.data.updates.find(
      (op: { entityId?: string; id?: string }) => op.entityId === charY || op.id === charY,
    );
    expect(yBase).toBeDefined();

    // Device B edits on top of what it pulled.
    const bPush = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: charY,
        version: 1,
        changes: { name: 'Y2', version: 1 },
        clientOperationId: `local-${charY}-rename`,
      },
    ]);
    expect(bPush.data.conflicts).toEqual([]);

    // Device A pulls: its own three ops as echoes plus B's edit, nothing twice, nothing missing.
    const aPull = await pull(ana.token, storyId, before);
    expect(aPull.data.updates).toHaveLength(4);
    const versions = aPull.data.updates.map(
      (op: { operationVersion: number }) => op.operationVersion,
    );
    expect([...versions].sort((x: number, y: number) => x - y)).toEqual(versions);
    expect(new Set(versions).size).toBe(4);
    expect(aPull.data.updates[3]).toMatchObject({
      type: 'update',
      entity: 'Character',
      id: charY,
    });

    // Device B catches its own echo and goes quiet.
    const bSecond = await pull(ana.token, storyId, bCursor);
    expect(bSecond.data.updates).toHaveLength(1);
    expect(bSecond.data.serverMaxOperationVersion).toBe(aPull.data.serverMaxOperationVersion);

    const rows = await db.query.characters.findMany({ where: eq(characters.storyId, storyId) });
    expect(rows.find((row) => row.id === charX)).toMatchObject({ name: 'X2', version: 2 });
    expect(rows.find((row) => row.id === charY)).toMatchObject({ name: 'Y2', version: 2 });
  });
});

describe('pulling past one page', () => {
  it('pages a large backlog in order without gaps or duplicates', async () => {
    const ids = Array.from({ length: 501 }, () => newId());
    const before = (await pull(ana.token, storyId, 0)).data.serverMaxOperationVersion;
    // The route caps batches like the client chunks them; three pushes build the backlog.
    for (let at = 0; at < ids.length; at += 200) {
      const pushed = await push(
        ana.token,
        storyId,
        ids.slice(at, at + 200).map((id, index) => createCharacter(id, `Bulk ${at + index}`)),
      );
      expect(pushed.data.conflicts).toEqual([]);
    }

    // Same loop the client runs: follow full pages, advancing to the highest seen version.
    const seen: { operationVersion: number; operationId: string }[] = [];
    let cursor = before;
    for (let page = 0; page < 5; page += 1) {
      const response = await pull(ana.token, storyId, cursor);
      expect(response.status).toBe(200);
      seen.push(...response.data.updates);
      if (response.data.updates.length === 0) break;
      cursor = Math.max(
        cursor,
        ...response.data.updates.map((op: { operationVersion: number }) => op.operationVersion),
      );
      if (response.data.updates.length < 500) break;
    }

    expect(seen).toHaveLength(501);
    const versions = seen.map((op) => op.operationVersion);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(new Set(seen.map((op) => op.operationId)).size).toBe(501);
  });
});

describe('pulling after history compaction', () => {
  it('converges a stale client to the final state through the squashed row', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'v0')]);
    let base = 1;
    for (let round = 1; round <= 25; round += 1) {
      const edited = await push(ana.token, storyId, [
        {
          type: 'update',
          entity: 'Character',
          id: characterId,
          version: base,
          changes: { name: `v${round}`, version: base },
          clientOperationId: `local-${characterId}-r${round}`,
        },
      ]);
      expect(edited.data.conflicts).toEqual([]);
      base = edited.data.applied[0].entityVersion;
    }
    const before = 0;

    const compacted = await compactStoryUpdateHistory(
      storyId,
      { olderThan: new Date(Date.now() + 60_000), keepRecentPerEntity: 1 },
      db,
    );
    expect(compacted.removedRows).toBeGreaterThan(0);

    // A client that never pulled anything still converges: the create plus one merged
    // update carrying the final state.
    const pulled = await pull(ana.token, storyId, before);
    const entityOps = pulled.data.updates.filter(
      (op: { id?: string; entityId?: string }) =>
        op.id === characterId || op.entityId === characterId,
    );
    expect(entityOps.length).toBeLessThan(26);
    expect(entityOps[0]).toMatchObject({ type: 'create' });
    const last = entityOps[entityOps.length - 1];
    expect(last).toMatchObject({ type: 'update' });
    expect((last.changes as { name: string }).name).toBe('v25');

    // And a client pulling from inside the squashed range lands on the same truth.
    const midVersion = entityOps[0].operationVersion;
    const mid = await pull(ana.token, storyId, midVersion);
    const midNames = mid.data.updates
      .filter((op: { id?: string; type?: string }) => op.id === characterId && op.type === 'update')
      .map((op: { changes: { name: string } }) => op.changes.name);
    expect(midNames[midNames.length - 1]).toBe('v25');
  });
});
