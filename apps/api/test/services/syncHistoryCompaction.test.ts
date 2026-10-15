import { ulid } from 'ulid';
import { describe, expect, it } from 'vitest';
import {
  defaultCompactionPolicy,
  DEFAULT_HEAVY_KEEP_RECENT_PER_ENTITY,
  DEFAULT_HEAVY_SQUASH_AGE_MS,
  DEFAULT_KEEP_RECENT_PER_ENTITY,
  DEFAULT_SQUASH_AGE_MS,
  HEAVY_ENTITY_TYPES,
  mergeRunPayloads,
  planUpdateSquash,
  recordedAt,
  type CompactableOperation,
  type HistoryCompactionPolicy,
} from '@/services/sync/SyncHistoryCompaction';

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

  it('never crosses a create or a delete', () => {
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
    const policy = defaultCompactionPolicy(now);

    expect(policy.olderThan).toEqual(new Date('2026-09-12T12:00:00.000Z'));
    expect(policy.keepRecentPerEntity).toBe(20);
  });

  it('squashes the heavy types after two days and keeps only their newest 3', () => {
    const now = new Date('2026-09-19T12:00:00.000Z');
    const policy = defaultCompactionPolicy(now);

    expect(Object.keys(policy.byEntityType ?? {}).sort()).toEqual([...HEAVY_ENTITY_TYPES].sort());
    for (const type of HEAVY_ENTITY_TYPES) {
      expect(policy.byEntityType?.[type]).toEqual({
        olderThan: new Date('2026-09-17T12:00:00.000Z'),
        keepRecentPerEntity: DEFAULT_HEAVY_KEEP_RECENT_PER_ENTITY,
      });
    }
    expect(DEFAULT_HEAVY_SQUASH_AGE_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe('per-type rules', () => {
  const HEAVY_CUTOFF = new Date('2026-05-01T00:00:00.000Z');
  const policy: HistoryCompactionPolicy = {
    olderThan: CUTOFF,
    keepRecentPerEntity: 20,
    byEntityType: { Scene: { olderThan: HEAVY_CUTOFF, keepRecentPerEntity: 3 } },
  };
  const BETWEEN = new Date('2026-04-01T00:00:00.000Z');

  it('squashes a heavy entity that is older than its rule but younger than the general one', () => {
    sequence = 0;
    const scenes = Array.from({ length: 6 }, () => op({ entityType: 'Scene', createdAt: BETWEEN }));
    const characters = Array.from({ length: 6 }, () =>
      op({ entityType: 'Character', entityId: 'c-1', createdAt: BETWEEN }),
    );

    const runs = planUpdateSquash([...scenes, ...characters], policy);

    // BETWEEN is after the general cutoff (CUTOFF = March), so the characters stay; the scenes are
    // older than the heavy cutoff only if it is later than BETWEEN - which it is (May).
    expect(runs).toHaveLength(1);
    expect(runs[0]!.keepId).toBe(scenes[2]!.id);
    expect(runs[0]!.deleteIds).toEqual([scenes[0]!.id, scenes[1]!.id]);
  });

  it('keeps the newest 3 updates of a heavy entity and 20 of the others', () => {
    sequence = 0;
    const scenes = Array.from({ length: 8 }, () => op({ entityType: 'Scene' }));
    const characters = Array.from({ length: 8 }, () =>
      op({ entityType: 'Character', entityId: 'c-1' }),
    );

    const runs = planUpdateSquash([...scenes, ...characters], policy);

    // Scenes: the oldest 5 collapse into the 5th; the newest 3 stay. Characters: all 8 are within the 20 kept.
    expect(runs).toHaveLength(1);
    expect(runs[0]!.deleteIds).toEqual(scenes.slice(0, 4).map((row) => row.id));
    expect(runs[0]!.keepId).toBe(scenes[4]!.id);
  });
});

describe('squashing never changes what an entity ends up as', () => {
  /** A small deterministic generator, so a failure names its seed and can be replayed. */
  function random(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
  const FIELDS = ['body', 'title', 'summary', 'color', 'rank'];

  it('folds to the same state before and after, for random edit histories', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const next = random(seed);
      sequence = 0;
      const payloads = new Map<string, Record<string, unknown>>();
      const rows: CompactableOperation[] = [];
      const count = 2 + Math.floor(next() * 30);
      // One entity has one type for its whole life.
      const entityType = next() < 0.5 ? 'Scene' : 'Character';
      for (let index = 0; index < count; index += 1) {
        const row = op({ entityType, entityId: 'e-1' });
        // A structural row now and then: runs must not cross it.
        if (next() < 0.1) row.operationType = 'delete';
        const payload: Record<string, unknown> = {};
        for (const field of FIELDS) if (next() < 0.4) payload[field] = `${field}-${index}`;
        payloads.set(row.id, payload);
        rows.push(row);
      }
      const policy: HistoryCompactionPolicy = {
        olderThan: CUTOFF,
        keepRecentPerEntity: 1 + Math.floor(next() * 5),
        byEntityType: {
          Scene: { olderThan: CUTOFF, keepRecentPerEntity: 1 + Math.floor(next() * 3) },
        },
      };

      const folded = (log: CompactableOperation[], store: Map<string, Record<string, unknown>>) =>
        log
          .filter((row) => row.entityId === 'e-1')
          .sort((left, right) => left.operationVersion - right.operationVersion)
          .reduce<Record<string, unknown>>(
            (state, row) => ({ ...state, ...store.get(row.id) }),
            {},
          );
      const before = folded(rows, payloads);

      let remaining = [...rows];
      const squashed = new Map(payloads);
      for (const run of planUpdateSquash(rows, policy)) {
        const members = rows
          .filter((row) => run.deleteIds.includes(row.id) || row.id === run.keepId)
          .sort((left, right) => left.operationVersion - right.operationVersion);
        squashed.set(run.keepId, mergeRunPayloads(members.map((row) => payloads.get(row.id)!)));
        remaining = remaining.filter((row) => !run.deleteIds.includes(row.id));
        // The run's last row keeps its version, so the sequence of versions stays valid.
        expect(rows.find((row) => row.id === run.keepId)!.operationVersion).toBe(
          run.operationVersion,
        );
      }

      expect(folded(remaining, squashed), `seed ${seed}`).toEqual(before);
    }
  });
});

describe('age by the server clock', () => {
  it("judges a row's age by when the server recorded it, not by the client's clock", () => {
    // Recorded recently by the server, but stamped months back by a device whose clock lagged.
    const lagging = op({ id: ulid(RECENT.getTime()), createdAt: OLD });
    const next = op({ id: ulid(RECENT.getTime()), createdAt: OLD });

    expect(recordedAt(lagging)).toBe(RECENT.getTime());
    expect(
      planUpdateSquash([lagging, next], { olderThan: CUTOFF, keepRecentPerEntity: 0 }),
    ).toEqual([]);
  });

  it('falls back to the operation time for ids that are not ULIDs', () => {
    expect(recordedAt(op({ id: 'legacy-row', createdAt: OLD }))).toBe(OLD.getTime());
  });
});
