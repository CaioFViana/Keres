import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { characters, operationLog, stories } from '../../src/db/schema';
import { SyncService, syncService } from '../../src/services/SyncService';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const pull = (token: string, story: string, lastOperationVersion = 0) =>
  request('GET', `/sync/${story}/pull`, { token, query: { lastOperationVersion } });

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
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
});

/**
 * Before the fix, `operation_version` was computed by `coalesce(max(...), 0) + 1` with neither a lock
 * nor a transaction wrapping both steps - two concurrent requests on the same story could compute the
 * same next number before either committed. One of the two then became invisible forever in other
 * collaborators' incremental `pull` (the filter uses `operation_version > cursor`). This was never
 * exercised with real concurrency - only sequentially, where the bug does not show up.
 */
describe('concurrent pushes to the same story', () => {
  it('never assigns the same operationVersion to two operations', async () => {
    const idA = newId();
    const idB = newId();

    const [resultA, resultB] = await Promise.all([
      push(ana.token, storyId, [createCharacter(idA, 'Primeira')]),
      push(ana.token, storyId, [createCharacter(idB, 'Segunda')]),
    ]);

    expect(resultA.status).toBe(200);
    expect(resultB.status).toBe(200);
    expect(resultA.data.conflicts).toEqual([]);
    expect(resultB.data.conflicts).toEqual([]);

    const versionA = resultA.data.applied[0].operationVersion;
    const versionB = resultB.data.applied[0].operationVersion;
    expect(versionA).not.toBe(versionB);
  });

  it('makes both concurrent operations visible to a subsequent pull', async () => {
    const idA = newId();
    const idB = newId();

    await Promise.all([
      push(ana.token, storyId, [createCharacter(idA, 'Primeira')]),
      push(ana.token, storyId, [createCharacter(idB, 'Segunda')]),
    ]);

    const { data } = await pull(ana.token, storyId, 0);
    const pulledIds = data.updates.map((update: any) => update.id);

    expect(pulledIds).toEqual(expect.arrayContaining([idA, idB]));
  });

  it('keeps the operation_version sequence gapless and matching stories.lastOperationVersion', async () => {
    const ids = [newId(), newId(), newId(), newId()];

    await Promise.all(ids.map((id) => push(ana.token, storyId, [createCharacter(id, id)])));

    const { data } = await pull(ana.token, storyId, 0);
    const versions = data.updates
      .map((update: any) => update.operationVersion)
      .sort((a: number, b: number) => a - b);

    expect(versions).toEqual([1, 2, 3, 4]);

    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.lastOperationVersion).toBe(4);
  });
});

/**
 * Before the fix, writing the entity and recording it in the operation log were two separate steps
 * with no shared transaction. A failure between the two left the entity mutated but invisible to
 * other clients - and a resend of the same operation by that very client hit a false
 * `version_conflict` against its own already-applied work.
 */
describe('atomicity between the entity write and the operation log', () => {
  it('rolls back the entity write when appending the operation log fails', async () => {
    const characterId = newId();
    const spy = vi
      .spyOn(syncService, 'appendOperationLog')
      .mockRejectedValueOnce(new Error('simulated failure between entity write and log append'));

    const { data } = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].reason).toBe('unknown');

    const found = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
    expect(found).toBeUndefined();

    spy.mockRestore();
  });

  it('lets a retry succeed cleanly after the rollback, with no leftover row in the way', async () => {
    const characterId = newId();
    const spy = vi
      .spyOn(syncService, 'appendOperationLog')
      .mockRejectedValueOnce(new Error('simulated failure between entity write and log append'));

    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    spy.mockRestore();

    const { data } = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });
});

describe('operation-log allocation guard', () => {
  it('refuses to append an operation for a story that disappeared before the counter could advance', async () => {
    await expect(
      syncService.appendOperationLog({
        storyId: newId(),
        userId: ana.userId,
        entityId: newId(),
        update: createCharacter(newId(), 'Sem história') as never,
      }),
    ).rejects.toThrow(/not found while appending/i);
  });
});

describe('SyncService defensive protocol paths', () => {
  it('returns an explicit conflict when a registered entity loses its handler instead of dropping the batch', async () => {
    // This cannot normally happen because the handler-registration architecture test keeps the
    // protocol enum in lockstep. It is nevertheless an important containment boundary for a
    // partial deploy: a malformed registry must not turn into a successful-looking sync.
    const isolatedService = new SyncService();
    (isolatedService.getEntityHandlers() as Map<string, unknown>).delete('Character');
    const characterId = newId();

    const result = await isolatedService.processAndRecordUpdates(ana.userId, storyId, [
      createCharacter(characterId, 'Keres') as never,
    ]);

    expect(result.applied).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        entity: 'Character',
        entityId: characterId,
        reason: 'unknown',
        message: expect.stringContaining('No sync handler'),
      }),
    ]);
    expect(await db.query.characters.findFirst({ where: eq(characters.id, characterId) })).toBeUndefined();
  });

  it('treats a delete for an absent entity as an idempotent successful outcome', async () => {
    const characterId = newId();

    const { data } = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Character', id: characterId, version: 1, clientOperationId: 'gone' },
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toEqual([
      expect.objectContaining({
        clientOperationId: 'gone',
        entityId: characterId,
        operationVersion: 0,
      }),
    ]);
  });

  it('uses safe fallback payloads when administrative recovery logs a delete or reorder without a handler', async () => {
    const isolatedService = new SyncService();
    (isolatedService.getEntityHandlers() as Map<string, unknown>).delete('Character');
    const deletedId = newId();

    const deleted = await isolatedService.appendOperationLog({
      storyId,
      userId: ana.userId,
      entityId: deletedId,
      update: { type: 'delete', entity: 'Character', id: deletedId, version: 1 } as never,
    });
    const reordered = await isolatedService.appendOperationLog({
      storyId,
      userId: ana.userId,
      entityId: storyId,
      update: {
        type: 'reorder',
        entity: 'Character',
        id: storyId,
        reorderItems: [{ id: deletedId, newIndex: 1 }],
      } as never,
    });
    const malformed = await isolatedService.appendOperationLog({
      storyId,
      userId: ana.userId,
      entityId: '',
      // A recovery import is trusted only at its boundary: an unknown operation kind must remain a
      // non-destructive update in the persistent log, and an empty entity id must never be stored.
      update: { type: 'not-a-sync-operation', entity: 'Character', id: '' } as never,
    });

    const rows = await db.query.operationLog.findMany({
      where: (table, { inArray }) => inArray(table.id, [deleted.id, reordered.id, malformed.id]),
      orderBy: (table, { asc }) => [asc(table.operationVersion)],
    });
    expect(rows).toEqual([
      expect.objectContaining({ operationType: 'delete', entityId: deletedId, payload: { id: deletedId } }),
      expect.objectContaining({
        operationType: 'reorder',
        payload: expect.objectContaining({ reorderItems: [{ id: deletedId, newIndex: 1 }] }),
      }),
      expect.objectContaining({ operationType: 'update', entityId: expect.any(String), payload: {} }),
    ]);
    expect(rows[2].entityId).not.toBe('');
  });

  it('rejects missing stories before it can apply or expose any operation', async () => {
    const isolatedService = new SyncService();
    const missingStoryId = newId();

    await expect(
      isolatedService.processAndRecordUpdates(ana.userId, missingStoryId, [
        createCharacter(newId(), 'Sem história') as never,
      ]),
    ).rejects.toThrow('Story not found');
    await expect(isolatedService.getUpdatesForStory(ana.userId, missingStoryId, 0)).rejects.toThrow(
      'Story not found',
    );
  });

  it('turns malformed operation times into validation conflicts even when bypassing route parsing', async () => {
    const isolatedService = new SyncService();
    const characterId = newId();

    const result = await isolatedService.processAndRecordUpdates(ana.userId, storyId, [
      { ...createCharacter(characterId, 'Tempo inválido'), operationTime: 'not-a-date' } as never,
    ]);

    expect(result.applied).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ entityId: characterId, reason: 'validation', message: expect.stringContaining('invalid') }),
    ]);
  });

  it('fails loudly when persisted history contains a reorder for an unsupported entity', async () => {
    await db.insert(operationLog).values({
      id: newId(),
      storyId,
      userId: ana.userId,
      operationVersion: 1,
      operationType: 'reorder',
      entityType: 'Character',
      entityId: newId(),
      payload: { reorderItems: [] },
      entityVersion: 1,
      createdAt: new Date(),
    } as never);

    await expect(syncService.getUpdatesForStory(ana.userId, storyId, 0)).rejects.toThrow(
      'Unhandled reorder entity type: Character',
    );
  });
});
