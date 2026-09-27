import { asc, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { operationLog } from '../../src/db/schema';
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

/** Eight days ago: old enough for the default 7-day compaction policy. */
const OLD_MS = Date.now() - 8 * 24 * 60 * 60 * 1000;
const OLD_TIME = new Date(OLD_MS).toISOString();

/**
 * Makes the story's history look recorded by the server eight days ago. Age is read from the
 * server clock the row id carries (a ULID minted at append), never from the client's operation
 * time - so this rewrites the ids, which is what time passing would have produced.
 */
async function ageRecordedHistory() {
  const rows = await db.query.operationLog.findMany({
    where: eq(operationLog.storyId, storyId),
    columns: { id: true },
  });
  for (const row of rows) {
    await db
      .update(operationLog)
      .set({ id: ulid(OLD_MS) })
      .where(eq(operationLog.id, row.id));
  }
}

/** A create plus 22 chained updates, all "written" 8 days ago. */
function agedCharacterHistory(characterId: string, baseName: string): unknown[] {
  const updates: unknown[] = [
    {
      type: 'create',
      entity: 'Character',
      id: characterId,
      version: 0,
      data: { id: characterId, storyId, name: `${baseName} 0` },
      clientOperationId: 'local-create',
      operationTime: OLD_TIME,
    },
  ];
  for (let base = 1; base <= 22; base += 1) {
    updates.push({
      type: 'update',
      entity: 'Character',
      id: characterId,
      version: base,
      changes: { name: `${baseName} ${base}`, version: base },
      clientOperationId: `local-update-${base}`,
      operationTime: OLD_TIME,
    });
  }
  return updates;
}

async function characterOps() {
  return db.query.operationLog
    .findMany({
      where: eq(operationLog.storyId, storyId),
      orderBy: [asc(operationLog.operationVersion)],
    })
    .then((rows) => rows.filter((row) => row.entityType === 'Character'));
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('history compaction', () => {
  it('squashes old update runs, keeping the merged final state', async () => {
    const characterId = newId();

    const { status, data } = await push(
      ana.token,
      storyId,
      agedCharacterHistory(characterId, 'Nome'),
    );

    expect(status).toBe(200);
    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(23);
    await ageRecordedHistory();
    await compactStoryUpdateHistory(storyId);

    // 22 updates, all old, but the newest 20 stay granular: only #1+#2 collapse into #2's row.
    const ops = await characterOps();
    expect(ops).toHaveLength(22);
    expect(ops.map((row) => row.operationVersion)).toEqual([
      1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ]);

    // The create is the idempotency record: never squashed.
    expect(ops[0]).toMatchObject({ operationType: 'create' });

    // The kept row carries the merged final state of its run (later wins per field).
    const squashed = ops.find((row) => row.operationVersion === 3)!;
    expect(squashed.operationType).toBe('update');
    expect(squashed.payload).toMatchObject({ name: 'Nome 2' });

    // The story counter still matches the highest row: the sequence stays valid.
    expect(data.serverMaxOperationVersion).toBe(23);
  });

  it('lets a client pulling from inside the squashed range converge on the final state', async () => {
    const characterId = newId();
    await push(ana.token, storyId, agedCharacterHistory(characterId, 'Nome'));
    await ageRecordedHistory();
    await compactStoryUpdateHistory(storyId);

    // This client synced through version 2 - a row that no longer exists.
    const { status, data } = await pull(ana.token, storyId, 2);

    expect(status).toBe(200);
    const versions = data.updates.map(
      (update: { operationVersion: number }) => update.operationVersion,
    );
    expect(versions[0]).toBe(3);
    expect([...versions].sort((left: number, right: number) => left - right)).toEqual(versions);

    // The squashed row reapplies what the client knew (#1+#2 merged), then the chain continues.
    const characterUpdates = data.updates.filter(
      (update: { entity: string }) => update.entity === 'Character',
    );
    expect(characterUpdates[0].changes).toMatchObject({ name: 'Nome 2' });
    expect(characterUpdates.at(-1).changes).toMatchObject({ name: 'Nome 22' });
  });

  it('does not touch history the server recorded recently, whatever the client clock said', async () => {
    const characterId = newId();

    // Every operation claims to be eight days old (a device whose clock lags): the push also
    // runs compaction, and it must leave what the server only just recorded alone.
    await push(ana.token, storyId, agedCharacterHistory(characterId, 'Fresco'));
    await compactStoryUpdateHistory(storyId);

    const ops = await characterOps();
    expect(ops).toHaveLength(23);
  });
});
