import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * The stream of operations the client produces when touching stat values, replayed through the real
 * push endpoint.
 *
 * `SyncEngineService.deriveBaseVersion` sends the *base* version (the one the client read before
 * writing), which is `payload.version - 1`; that is why a create goes with `version: 0` and the
 * delete of a just-created row goes with `version: 1`.
 */
let ana: TestUser;
let storyId: string;
let characterId: string;
let statId: string;

const push = (updates: unknown[]) =>
  request('POST', `/sync/${storyId}`, { token: ana.token, body: updates });

const create = (entity: string, id: string, data: Record<string, unknown>) => ({
  type: 'create' as const,
  entity,
  id,
  version: 0,
  data: { id, storyId, ...data },
  clientOperationId: `create-${id}-${Math.random()}`,
});

const remove = (entity: string, id: string, version: number) => ({
  type: 'delete' as const,
  entity,
  id,
  version,
  clientOperationId: `delete-${id}-${Math.random()}`,
});

const statValue = (id: string, value: number, modeId: string | null = null) =>
  create('StatRelation', id, { characterId, modeId, statId, value });

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
  characterId = newId();
  statId = newId();

  const seeded = await push([
    create('Character', characterId, { name: 'Ilda' }),
    create('Stat', statId, { name: 'Dexterity' }),
  ]);
  expect(seeded.data.conflicts).toEqual([]);
});

describe('stat values through the sync endpoint', () => {
  it('accepts a value, its removal and a new value in one batch', async () => {
    const first = newId();
    const second = newId();

    const { data } = await push([
      statValue(first, 5),
      remove('StatRelation', first, 1),
      statValue(second, 7),
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(3);
  });

  it('accepts the same sequence split across pushes', async () => {
    const first = newId();
    const second = newId();

    expect((await push([statValue(first, 5)])).data.conflicts).toEqual([]);
    expect((await push([remove('StatRelation', first, 1)])).data.conflicts).toEqual([]);
    expect((await push([statValue(second, 7)])).data.conflicts).toEqual([]);
  });

  it('refuses a second live value for the same character, mode and stat', async () => {
    const first = newId();
    const second = newId();

    await push([statValue(first, 5)]);
    const { data } = await push([statValue(second, 7)]);

    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].reason).toBe('validation');
  });

  it('is idempotent when the whole batch is pushed twice', async () => {
    const first = newId();
    const batch = [statValue(first, 5), remove('StatRelation', first, 1)];

    expect((await push(batch)).data.conflicts).toEqual([]);
    const { data } = await push(batch);

    expect(data.conflicts).toEqual([]);
  });
});
