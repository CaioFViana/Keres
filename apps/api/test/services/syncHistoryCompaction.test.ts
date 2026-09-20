import { describe, expect, it } from 'vitest';
import {
  defaultCompactionPolicy,
  DEFAULT_KEEP_RECENT_PER_ENTITY,
  DEFAULT_SQUASH_AGE_MS,
  mergeRunPayloads,
  planUpdateSquash,
  type CompactableOperation,
} from '../../src/services/sync/SyncHistoryCompaction';

const OLD = new Date('2026-01-01T00:00:00.000Z');
const RECENT = new Date('2026-06-01T00:00:00.000Z');
const CUTOFF = new Date('2026-03-01T00:00:00.000Z');

let sequence = 0;

function op(overrides: Partial<CompactableOperation> = {}): CompactableOperation {
  sequence += 1;
  return {
    id: `op-${sequence}`,
    entityType: 'Scene',
    entityId: 'scene-1',
    userId: 'ana',
    operationType: 'update',
    operationVersion: sequence,
    createdAt: OLD,
    ...overrides,
  };
}

describe('planUpdateSquash', () => {
  it('collapses an old update run into its last row', () => {
    sequence = 0;
    const rows = [op(), op(), op()];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      keepId: rows[2]!.id,
      operationVersion: rows[2]!.operationVersion,
      deleteIds: [rows[0]!.id, rows[1]!.id],
    });
  });

  it('keeps the newest K updates per entity granular, whatever their age', () => {
    sequence = 0;
    const rows = [op(), op(), op(), op()];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 2 });

    expect(runs).toHaveLength(1);
    expect(runs[0]!.keepId).toBe(rows[1]!.id);
    expect(runs[0]!.deleteIds).toEqual([rows[0]!.id]);
  });

  it('leaves recent updates alone', () => {
    sequence = 0;
    const rows = [op({ createdAt: OLD }), op({ createdAt: RECENT }), op({ createdAt: OLD })];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    // The recent row splits the run; lone survivors never squash.
    expect(runs).toEqual([]);
  });

  it('never crosses a create, delete or reorder', () => {
    sequence = 0;
    const rows = [
      op({ operationType: 'create' }),
      op(),
      op(),
      op({ operationType: 'delete' }),
      op(),
      op(),
    ];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toHaveLength(2);
    expect(runs[0]!.deleteIds).toEqual([rows[1]!.id]);
    expect(runs[0]!.keepId).toBe(rows[2]!.id);
    expect(runs[1]!.deleteIds).toEqual([rows[4]!.id]);
    expect(runs[1]!.keepId).toBe(rows[5]!.id);
  });

  it('never mixes entities in one run', () => {
    sequence = 0;
    const rows = [op({ entityId: 'scene-1' }), op({ entityId: 'scene-2' })];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toEqual([]);
  });

  it('segments favourites by author, so individual-mode visibility survives', () => {
    sequence = 0;
    const rows = [
      op({ entityType: 'Favorite', userId: 'ana' }),
      op({ entityType: 'Favorite', userId: 'bia' }),
      op({ entityType: 'Favorite', userId: 'bia' }),
    ];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toHaveLength(1);
    expect(runs[0]!.keepId).toBe(rows[2]!.id);
    expect(runs[0]!.deleteIds).toEqual([rows[1]!.id]);
  });

  it('does not segment other entities by author', () => {
    sequence = 0;
    const rows = [op({ userId: 'ana' }), op({ userId: 'bia' })];

    const runs = planUpdateSquash(rows, { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toHaveLength(1);
  });

  it('decides in version order, not input order', () => {
    sequence = 0;
    const first = op({ operationVersion: 1 });
    const second = op({ operationVersion: 2 });

    const runs = planUpdateSquash([second, first], { olderThan: CUTOFF, keepRecentPerEntity: 0 });

    expect(runs).toHaveLength(1);
    expect(runs[0]!.keepId).toBe(second.id);
  });
});

describe('mergeRunPayloads', () => {
  it('lets later values win per field, since updates carry full state', () => {
    expect(
      mergeRunPayloads([
        { name: 'Rascunho', summary: 'Antigo' },
        { name: 'Final' },
        { summary: null },
      ]),
    ).toEqual({ name: 'Final', summary: null });
  });

  it('merges nothing into an empty object', () => {
    expect(mergeRunPayloads([])).toEqual({});
  });
});

describe('defaultCompactionPolicy', () => {
  it('squashes week-old history while keeping the newest 20 updates per entity', () => {
    expect(DEFAULT_KEEP_RECENT_PER_ENTITY).toBe(20);
    expect(DEFAULT_SQUASH_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);

    const now = new Date('2026-09-19T12:00:00.000Z');
    expect(defaultCompactionPolicy(now)).toEqual({
      olderThan: new Date('2026-09-12T12:00:00.000Z'),
      keepRecentPerEntity: 20,
    });
  });
});
