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
