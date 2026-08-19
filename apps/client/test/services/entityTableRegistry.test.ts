/**
 * @jest-environment node
 */
import { getEntityTable, toEntityColumns } from '../../src/services/entityTableRegistry';

describe('entity table registry', () => {
  it('resolves known tables and declines unknown entity names', () => {
    expect(getEntityTable('Character')).toBeDefined();
    expect(getEntityTable('Unknown')).toBeUndefined();
  });

  it('keeps only writable table fields, protecting identity and reviving dates', () => {
    expect(
      toEntityColumns('Character', {
        id: 'external-id',
        storyId: 'external-story',
        name: 'Ada',
        updatedAt: '2026-08-14T12:00:00.000Z',
        arbitrary: 'discarded',
      }),
    ).toEqual({
      name: 'Ada',
      updatedAt: new Date('2026-08-14T12:00:00.000Z'),
    });
    expect(toEntityColumns('Unknown', { name: 'Ada' })).toEqual({});
  });
});

describe('toEntityColumns for CharacterRelation', () => {
  it('passes character1Id/character2Id through unchanged - they match the local column names', () => {
    const columns = toEntityColumns('CharacterRelation', {
      character1Id: 'char-a',
      character2Id: 'char-b',
      relationType: 'allies',
    });

    expect(columns).toEqual({
      character1Id: 'char-a',
      character2Id: 'char-b',
      relationType: 'allies',
    });
  });

  it('still drops protected fields and unknown columns', () => {
    const columns = toEntityColumns('CharacterRelation', {
      id: 'relation-1',
      storyId: 'story-1',
      character1Id: 'char-a',
      character2Id: 'char-b',
      notARealField: 'x',
    });

    expect(columns).toEqual({
      character1Id: 'char-a',
      character2Id: 'char-b',
    });
  });

  it('returns an empty object for an unregistered entity type', () => {
    expect(toEntityColumns('NotAnEntity', { character1Id: 'char-a' })).toEqual({});
  });
});
