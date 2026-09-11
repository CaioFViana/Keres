import { describe, expect, it } from 'vitest';
import {
  findContestedFields,
  mergeLocalOperationPayloads,
  syncConflictValuesDiffer,
} from '../../rules/syncConflict';

describe('sync conflict rules', () => {
  it('compares primitives, nulls, dates, and structured values consistently', () => {
    expect(syncConflictValuesDiffer('same', 'same')).toBe(false);
    expect(syncConflictValuesDiffer(null, undefined)).toBe(false);
    expect(syncConflictValuesDiffer(new Date('2025-01-01'), new Date('2025-01-01'))).toBe(false);
    expect(syncConflictValuesDiffer(new Date('2025-01-01'), new Date('2025-01-02'))).toBe(true);
    expect(syncConflictValuesDiffer({ a: 1 }, { a: 1 })).toBe(false);
    expect(syncConflictValuesDiffer({ a: 1 }, { a: 2 })).toBe(true);
    expect(syncConflictValuesDiffer(1, 2)).toBe(true);
  });

  it('finds only actual content conflicts and ignores synchronization bookkeeping', () => {
    expect(findContestedFields({ id: 'x', title: 'Local', count: 1 }, null)).toEqual([
      'title',
      'count',
    ]);
    expect(
      findContestedFields(
        { id: 'x', title: 'Local', count: 1, version: 2 },
        { title: 'Server', count: 1, version: 9 },
      ),
    ).toEqual(['title']);
  });

  it('merges valid operation payloads in order while tolerating malformed legacy entries', () => {
    expect(
      mergeLocalOperationPayloads([
        { payload: '{"title":"First","version":1}' },
        { payload: 'not-json' },
        { payload: '{"title":"Last","summary":"New","id":"ignored"}' },
      ]),
    ).toEqual({ title: 'Last', summary: 'New' });
  });
});
