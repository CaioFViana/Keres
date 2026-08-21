import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import { characters, stories } from '../../src/db/schema';
import { syncService } from '../../src/services/SyncService';
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
 * Antes da correção, `operation_version` era calculado por `coalesce(max(...), 0) + 1` sem
 * lock nem transação envolvendo os dois passos - duas requisições concorrentes na mesma
 * história podiam calcular o mesmo próximo número antes de qualquer uma commitar. Um dos
 * dois ficava então invisível para sempre no `pull` incremental de outros colaboradores
 * (o filtro usa `operation_version > cursor`). Isto nunca foi exercitado com concorrência
 * real - só sequencialmente, onde o bug não aparece.
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
 * Antes da correção, a escrita da entidade e o registro no log de operações eram dois
 * passos separados sem transação compartilhada. Uma falha entre os dois deixava a entidade
 * mutada mas invisível a outros clientes - e um reenvio da mesma operação pelo próprio
 * cliente batia um `version_conflict` falso contra o próprio trabalho já aplicado.
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
