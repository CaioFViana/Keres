import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { usingSqlite } from '../../src/db/dialect';
import { characters, operationLog } from '../../src/db/schema';
import { logger } from '../../src/utils/logger';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const pull = (token: string, story: string, lastOperationVersion = 0) =>
  request('GET', `/sync/${story}/pull`, { token, query: { lastOperationVersion } });

const createCharacter = (story: string, id: string, name: string) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version: 0,
  data: { id, storyId: story, name },
  clientOperationId: `local-${id}`,
});

const renameCharacter = (
  id: string,
  name: string,
  baseVersion: number,
  clientOperationId: string,
) => ({
  type: 'update' as const,
  entity: 'Character',
  id,
  version: baseVersion,
  changes: { name, version: baseVersion },
  clientOperationId,
});

async function logRowCount(story: string): Promise<number> {
  return (
    await db.query.operationLog.findMany({
      where: eq(operationLog.storyId, story),
      columns: { id: true },
    })
  ).length;
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('push idempotency via clientOperationId', () => {
  it('answers a resent update with its original versions instead of a false conflict', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(storyId, characterId, 'Keres')]);

    // The same batch object, sent twice: the second send is the "lost response" resend.
    const batch = [renameCharacter(characterId, 'Keres Renascida', 1, newId())];
    const first = await push(ana.token, storyId, batch);
    expect(first.status).toBe(200);
    expect(first.data.conflicts).toEqual([]);
    const originalVersion = first.data.applied[0].operationVersion;
    expect(first.data.applied[0].entityVersion).toBe(2);
    const rowsBeforeResend = await logRowCount(storyId);

    const resend = await push(ana.token, storyId, batch);

    expect(resend.status).toBe(200);
    expect(resend.data.conflicts).toEqual([]);
    // The ORIGINAL versions, not the current max: the client's echo check keys on them.
    expect(resend.data.applied).toEqual([
      expect.objectContaining({
        clientOperationId: batch[0].clientOperationId,
        operationVersion: originalVersion,
        entityVersion: 2,
        entityId: characterId,
      }),
    ]);
    expect(await logRowCount(storyId)).toBe(rowsBeforeResend);
    expect(
      await db.query.characters.findFirst({ where: eq(characters.id, characterId) }),
    ).toMatchObject({
      name: 'Keres Renascida',
      version: 2,
    });
  });

  it('scopes the idempotency key to its story', async () => {
    const otherStoryId = (await uploadTestStory(ana.token)).id;
    const charA = newId();
    const charB = newId();
    await push(ana.token, storyId, [createCharacter(storyId, charA, 'Primeira')]);
    await push(ana.token, otherStoryId, [createCharacter(otherStoryId, charB, 'Segunda')]);

    // The same key in two stories: both apply, each with its own log row.
    const sharedKey = newId();
    const appliedA = await push(ana.token, storyId, [renameCharacter(charA, 'A', 1, sharedKey)]);
    const appliedB = await push(ana.token, otherStoryId, [
      renameCharacter(charB, 'B', 1, sharedKey),
    ]);
    expect(appliedA.data.conflicts).toEqual([]);
    expect(appliedB.data.conflicts).toEqual([]);
    const rows = await db.query.operationLog.findMany({
      where: eq(operationLog.clientOperationId, sharedKey),
    });
    expect(rows.map((row) => row.storyId).sort()).toEqual([storyId, otherStoryId].sort());

    // And each resend answers with its own story's original version.
    const resendA = await push(ana.token, storyId, [renameCharacter(charA, 'A', 1, sharedKey)]);
    const resendB = await push(ana.token, otherStoryId, [
      renameCharacter(charB, 'B', 1, sharedKey),
    ]);
    expect(resendA.data.applied[0].operationVersion).toBe(
      appliedA.data.applied[0].operationVersion,
    );
    expect(resendB.data.applied[0].operationVersion).toBe(
      appliedB.data.applied[0].operationVersion,
    );
    expect(resendA.data.conflicts).toEqual([]);
    expect(resendB.data.conflicts).toEqual([]);
  });

  it('applies exactly once when the same batch is pushed concurrently', async () => {
    // Two tabs pushing the identical batch at once: whichever interleaving wins, the op lands
    // exactly once and both callers get success - never a false conflict, never a duplicate.
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(storyId, characterId, 'Keres')]);
    const batch = [renameCharacter(characterId, 'Concorrente', 1, newId())];

    const [left, right] = await Promise.all([
      push(ana.token, storyId, batch),
      push(ana.token, storyId, batch),
    ]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect(left.data.conflicts).toEqual([]);
    expect(right.data.conflicts).toEqual([]);
    expect(left.data.applied).toHaveLength(1);
    expect(right.data.applied).toHaveLength(1);
    // Exactly one of the two appended a log row; the other was acknowledged idempotently.
    const withRow = [left.data.applied[0], right.data.applied[0]].filter(
      (entry: { operationId?: string }) => entry.operationId,
    );
    expect(withRow).toHaveLength(1);
    expect(left.data.applied[0].operationVersion).toBe(right.data.applied[0].operationVersion);
    expect(
      await db.query.operationLog.findMany({
        where: eq(operationLog.clientOperationId, batch[0].clientOperationId),
      }),
    ).toHaveLength(1);
    expect(
      await db.query.characters.findFirst({ where: eq(characters.id, characterId) }),
    ).toMatchObject({ name: 'Concorrente', version: 2 });
  });

  it('keeps applying ops without a clientOperationId through the previous path', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(storyId, characterId, 'Keres')]);

    const { status, data } = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        version: 1,
        changes: { name: 'Sem chave', version: 1 },
      },
    ]);

    expect(status).toBe(200);
    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });
});

// Postgres declares operation_type as an ENUM, so this state is only representable on SQLite -
// where the column is text and a legacy/future value can actually sit in a row.
const itSqlite = usingSqlite ? it : it.skip;

describe('pull resilience to unknown operation types', () => {
  itSqlite('skips the row with a warning instead of failing the page', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(storyId, characterId, 'Keres')]);
    const unknownId = newId();
    await db.insert(operationLog).values({
      id: unknownId,
      storyId,
      userId: ana.userId,
      operationVersion: 2,
      operationType: 'time_travel',
      entityType: 'Character',
      entityId: newId(),
      payload: {},
      entityVersion: 1,
      createdAt: new Date(),
    } as never);

    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const { status, data } = await pull(ana.token, storyId, 0);

      expect(status).toBe(200);
      expect(data.updates.map((update: any) => update.id)).toEqual([characterId]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown sync operation'),
        expect.objectContaining({
          storyId,
          operationId: unknownId,
          operationVersion: 2,
        }),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
