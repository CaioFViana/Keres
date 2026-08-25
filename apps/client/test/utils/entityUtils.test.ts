import { createULID, getChangedFields, prepareNewEntityData } from '../../src/utils/entityUtils';

describe('createULID', () => {
  it('produces a 26-character Crockford ULID that the shared schemas accept', () => {
    expect(createULID()).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('does not repeat across a burst of calls in the same millisecond', () => {
    const ids = Array.from({ length: 200 }, () => createULID());

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts lexicographically by creation time, which is what the op log relies on', () => {
    const older = createULID();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    const newer = createULID();
    jest.restoreAllMocks();

    expect(newer > older).toBe(true);
  });
});

describe('prepareNewEntityData', () => {
  it('fills in the sync bookkeeping fields a brand new entity needs', () => {
    const entity = prepareNewEntityData<{ id: string; version: number; name: string }>({
      name: 'Keres',
    });

    expect(entity.name).toBe('Keres');
    expect(entity.id).toMatch(/^[0-9A-Z]{26}$/);
    expect(entity.version).toBe(1);
    expect(entity).toMatchObject({ isDeleted: false, deletedAt: null });
  });

  it('stamps createdAt and updatedAt with the same instant', () => {
    const entity = prepareNewEntityData<any>({ name: 'Keres' });

    expect(entity.createdAt.getTime()).toBe(entity.updatedAt.getTime());
  });

  it('lets the caller override the generated defaults', () => {
    const id = createULID();
    const entity = prepareNewEntityData<any>({ id, version: 7, isDeleted: true } as any);

    expect(entity).toMatchObject({ id, version: 7, isDeleted: true });
  });
});

/**
 * The diff feeds the operation log's `update` payload: a field it stops reporting simply never reaches
 * the server, and a false positive produces a version conflict where nothing changed.
 */
describe('getChangedFields', () => {
  it('returns nothing when the objects are equal', () => {
    expect(getChangedFields({ name: 'Keres', version: 1 }, { name: 'Keres', version: 1 })).toEqual(
      {},
    );
  });

  it('reports only the fields that actually changed', () => {
    expect(
      getChangedFields(
        { name: 'Keres', title: 'A', version: 1 },
        { name: 'Nyx', title: 'A', version: 1 },
      ),
    ).toEqual({ name: 'Nyx' });
  });

  it('reports a field that only exists in the new object', () => {
    expect(getChangedFields({ name: 'Keres' } as any, { name: 'Keres', title: 'Deusa' })).toEqual({
      title: 'Deusa',
    });
  });

  it('marks a removed field as null, since JSON.stringify would drop undefined', () => {
    const changes = getChangedFields(
      { name: 'Keres', title: 'Deusa' } as any,
      { name: 'Keres' } as any,
    );

    expect(changes).toEqual({ title: null });
    expect(JSON.parse(JSON.stringify(changes))).toEqual({ title: null });
  });

  it('distinguishes null from undefined as a new value', () => {
    expect(getChangedFields({ title: 'Deusa' } as any, { title: null } as any)).toEqual({
      title: null,
    });
  });

  it('compares dates by instant, not by identity', () => {
    const instant = new Date('2026-08-11T18:00:00.000Z');

    expect(
      getChangedFields({ updatedAt: instant }, { updatedAt: new Date(instant.getTime()) }),
    ).toEqual({});
  });

  it('detects a date change that a naive object comparison would miss', () => {
    const older = new Date('2026-08-11T18:00:00.000Z');
    const newer = new Date('2026-08-12T18:00:00.000Z');

    expect(getChangedFields({ updatedAt: older }, { updatedAt: newer })).toEqual({
      updatedAt: newer,
    });
  });

  it('detects a date replaced by a non-date value', () => {
    const date = new Date('2026-08-11T18:00:00.000Z');

    expect(getChangedFields({ deletedAt: date } as any, { deletedAt: null } as any)).toEqual({
      deletedAt: null,
    });
  });

  it('returns only the changed leaves of a nested object', () => {
    const changes = getChangedFields(
      { meta: { color: 'red', size: 2 } },
      { meta: { color: 'blue', size: 2 } },
    );

    expect(changes).toEqual({ meta: { color: 'blue' } });
  });

  it('omits a nested object whose leaves are all unchanged', () => {
    expect(getChangedFields({ meta: { color: 'red' } }, { meta: { color: 'red' } })).toEqual({});
  });

  it('replaces an array wholesale when any element differs', () => {
    expect(getChangedFields({ tags: ['a', 'b'] }, { tags: ['a', 'c'] })).toEqual({
      tags: ['a', 'c'],
    });
    expect(getChangedFields({ tags: ['a'] }, { tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] });
    expect(getChangedFields({ tags: ['a', 'b'] }, { tags: ['a', 'b'] })).toEqual({});
  });

  it('treats an array replacing an object as a change', () => {
    expect(getChangedFields({ value: { a: 1 } } as any, { value: [1] } as any)).toEqual({
      value: [1],
    });
  });

  it('treats the whole new object as changed when there is no old object', () => {
    expect(getChangedFields(null as any, { name: 'Keres' })).toEqual({ name: 'Keres' });
  });

  it('reports nothing when the new object is missing, since deletion is handled elsewhere', () => {
    expect(getChangedFields({ name: 'Keres' }, null as any)).toEqual({});
    expect(getChangedFields(null as any, null as any)).toEqual({});
  });
});
