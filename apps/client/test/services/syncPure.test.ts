/**
 * @jest-environment node
 */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import {
  describeIncorporatedOperation,
  maskSupersededUpdate,
  onlyPlaces,
  protectRemoteUpdate,
  withRankProtocol,
} from '../../src/services/sync/syncPure';

describe('protectRemoteUpdate', () => {
  it('drops unknown keys from an update so a newer server field cannot stall the pull', () => {
    const update = {
      type: 'update',
      entity: 'Character',
      id: 'character-1',
      changes: {
        name: 'Server name',
        version: 7,
        someFutureField: 'from a newer server',
      },
    } as UpdateStoryUpdate;

    const result = protectRemoteUpdate(update) as UpdateStoryUpdate;

    expect(result.changes).toEqual({ name: 'Server name', version: 7 });
  });

  it('drops unknown keys from a create while keeping every real column', () => {
    const update = {
      type: 'create',
      entity: 'Character',
      id: 'character-1',
      data: {
        name: 'Server name',
        version: 1,
        updatedAt: '2026-09-24T00:00:00.000Z',
        someFutureField: 'from a newer server',
      },
    } as unknown as CreateStoryUpdate;

    const result = protectRemoteUpdate(update) as CreateStoryUpdate;

    expect(result.data).toEqual({
      name: 'Server name',
      version: 1,
      updatedAt: new Date('2026-09-24T00:00:00.000Z'),
    });
  });

  it('still strips local bookkeeping columns', () => {
    const update = {
      type: 'update',
      entity: 'Story',
      id: 'story-1',
      changes: { title: 'Server title', version: 3, myRole: 'owner', userId: 'someone-else' },
    } as unknown as UpdateStoryUpdate;

    const result = protectRemoteUpdate(update) as UpdateStoryUpdate;

    expect(result.changes).toEqual({ title: 'Server title', version: 3 });
  });

  it('passes deletes through untouched', () => {
    const del = { type: 'delete', entity: 'Character', id: 'character-1' } as never;

    expect(protectRemoteUpdate(del)).toBe(del);
  });
});

describe('maskSupersededUpdate', () => {
  const later = (fields: string[], serverOperationVersion = 9, restores = false) => ({
    serverOperationVersion,
    fields: new Set(fields),
    restores,
  });
  const update = (changes: Record<string, unknown>) =>
    ({
      type: 'update',
      entity: 'Character',
      id: 'X',
      version: 3,
      operationVersion: 5,
      changes: { ...changes, version: 3, updatedAt: '2026-01-01T00:00:00.000Z' },
    }) as UpdateStoryUpdate;

  it('passes an operation through when nothing later was incorporated', () => {
    const op = update({ name: 'Remote' });
    expect(maskSupersededUpdate(op, [later(['name'], 5), later(['name'], 2)], true)).toBe(op);
  });

  it('keeps only the fields no later operation rewrote, never moving the version', () => {
    const masked = maskSupersededUpdate(
      update({ name: 'Remote', title: 'Remote title' }),
      [later(['name'])],
      true,
    ) as UpdateStoryUpdate;

    expect(masked.changes).toEqual({ title: 'Remote title' });
  });

  it('drops an operation whose every field was rewritten later', () => {
    expect(maskSupersededUpdate(update({ name: 'Remote' }), [later(['name'])], true)).toBeNull();
  });

  it('turns a create over an existing row into an update of what is left', () => {
    const create = {
      type: 'create',
      entity: 'Character',
      id: 'X',
      operationVersion: 5,
      version: 1,
      data: { name: 'Remote', title: 'T', version: 1 },
    } as CreateStoryUpdate;

    expect(maskSupersededUpdate(create, [later(['name'])], true)).toMatchObject({
      type: 'update',
      changes: { title: 'T' },
    });
    expect(maskSupersededUpdate(create, [later(['name'])], false)).toBe(create);
  });

  it('drops a deletion a later restore undid, and masks its tombstone otherwise', () => {
    const deletion = {
      type: 'delete',
      entity: 'Character',
      id: 'X',
      operationVersion: 5,
      data: { name: 'Tomb', title: 'T', isDeleted: true },
    } as DeleteStoryUpdate;

    expect(maskSupersededUpdate(deletion, [later(['isDeleted'], 9, true)], true)).toBeNull();
    expect(maskSupersededUpdate(deletion, [later(['name'])], true)).toMatchObject({
      type: 'delete',
      data: { title: 'T', isDeleted: true },
    });
  });
});

describe('describeIncorporatedOperation', () => {
  it('lists the content fields a synchronized row wrote and whether it restored', () => {
    expect(
      describeIncorporatedOperation({
        payload: JSON.stringify({ name: 'N', isDeleted: false, version: 4, updatedAt: 'x' }),
        serverOperationVersion: 7,
      }),
    ).toEqual({
      serverOperationVersion: 7,
      fields: new Set(['name', 'isDeleted']),
      restores: true,
    });
  });

  it('ignores rows the server never ordered and payloads it cannot read', () => {
    expect(describeIncorporatedOperation({ payload: '{}', serverOperationVersion: 0 })).toBeNull();
    expect(
      describeIncorporatedOperation({ payload: 'nope', serverOperationVersion: 3 }),
    ).toBeNull();
    expect(describeIncorporatedOperation({ payload: '5', serverOperationVersion: 3 })).toBeNull();
  });
});

describe('withRankProtocol', () => {
  it('never lets an update write the derived position of an arranged row', () => {
    const update = withRankProtocol({
      type: 'update',
      entity: 'Scene',
      id: 'scene-1',
      changes: { name: 'N', rank: 'a5', index: 3, version: 2 },
    } as UpdateStoryUpdate) as UpdateStoryUpdate;
    expect(update.changes).toEqual({ name: 'N', rank: 'a5', version: 2 });
  });

  it('leaves other entities and a create carrying its rank alone', () => {
    const character = {
      type: 'update',
      entity: 'Character',
      id: 'c',
      changes: { index: 3, version: 1 },
    } as UpdateStoryUpdate;
    expect(withRankProtocol(character)).toBe(character);
    const ranked = withRankProtocol({
      type: 'create',
      entity: 'Chapter',
      id: 'ch',
      data: { index: 9, rank: 'a0V' },
    } as CreateStoryUpdate) as CreateStoryUpdate;
    expect(ranked.data.rank).toBe('a0V');
  });
});

describe('onlyPlaces', () => {
  it('holds for a rank or a container change, and nothing else', () => {
    expect(onlyPlaces('Scene', { rank: 'a1', chapterId: 'c', version: 3 })).toBe(true);
    expect(onlyPlaces('Chapter', { type: 'event', rank: 'a1' })).toBe(true);
    expect(onlyPlaces('Scene', { rank: 'a1', name: 'N' })).toBe(false);
    expect(onlyPlaces('Character', { rank: 'a1' })).toBe(false);
  });
});
