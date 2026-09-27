import { describe, expect, it } from 'vitest';
import {
  compareRanked,
  derivePositions,
  isValidRank,
  rankAtPosition,
  rankAtPositionOf,
  MAX_RANK_LENGTH,
  planRankChanges,
  rankBetween,
  ranksBetween,
} from '../../rules/rank';

/** A small deterministic generator, so a failing case can be replayed from its seed. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const applyChanges = (
  rows: { id: string; rank: string }[],
  changes: Map<string, string>,
): { id: string; rank: string }[] =>
  rows.map((row) => ({ id: row.id, rank: changes.get(row.id) ?? row.rank }));

const orderOf = (rows: { id: string; rank: string }[]) =>
  [...rows].sort(compareRanked).map((row) => row.id);

describe('rank keys', () => {
  it('always lands strictly between its neighbours', () => {
    const next = random(7);
    let keys = [rankBetween(null, null)];
    for (let step = 0; step < 3000; step += 1) {
      const at = Math.floor(next() * (keys.length + 1));
      const lower = at === 0 ? null : keys[at - 1]!;
      const upper = at === keys.length ? null : keys[at]!;
      const key = rankBetween(lower, upper);
      expect(isValidRank(key)).toBe(true);
      if (lower !== null) expect(key > lower).toBe(true);
      if (upper !== null) expect(key < upper).toBe(true);
      keys = [...keys.slice(0, at), key, ...keys.slice(at)];
    }
    expect([...keys].sort()).toEqual(keys);
  });

  it('spreads several keys between two, in order', () => {
    const keys = ranksBetween('a0', 'a1', 25);
    expect(keys).toHaveLength(25);
    expect([...keys].sort()).toEqual(keys);
    expect(keys[0]! > 'a0' && keys.at(-1)! < 'a1').toBe(true);
    expect(new Set(keys).size).toBe(25);
  });

  it('refuses what it cannot place between', () => {
    expect(() => rankBetween('a1', 'a1')).toThrow();
    expect(() => rankBetween('a2', 'a1')).toThrow();
    expect(() => rankBetween('', null)).toThrow();
    expect(isValidRank('')).toBe(false);
    expect(isValidRank('a10')).toBe(false);
    expect(isValidRank('a1-')).toBe(false);
    expect(isValidRank(3)).toBe(false);
  });

  it('keeps legacy positions in their order, deterministically', () => {
    const keys = Array.from({ length: 5000 }, (_, position) => rankAtPosition(position));
    expect([...keys].sort()).toEqual(keys);
    expect(keys.every(isValidRank)).toBe(true);
    expect(rankAtPosition(1)).toBe('a1');
    expect(rankAtPosition(62)).toBe('b00');
    expect(rankAtPosition(-4)).toBe(rankAtPosition(0));
    // Stats and schema fields store a 0-based order: the same key as the 1-based wire index.
    expect(rankAtPositionOf('Stat', 0)).toBe(rankAtPositionOf('Scene', 1));
  });
});

describe('planRankChanges', () => {
  const ranked = (ids: string[]) =>
    ids.map((id, index) => ({ id, rank: rankAtPosition(index + 1) }));

  it('moves only the row that moved', () => {
    const rows = ranked(['a', 'b', 'c', 'd', 'e']);
    const changes = planRankChanges(rows, ['a', 'd', 'b', 'c', 'e']);
    expect([...changes.keys()]).toEqual(['d']);
    expect(orderOf(applyChanges(rows, changes))).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('changes nothing for the order already held', () => {
    const rows = ranked(['a', 'b', 'c']);
    expect(planRankChanges(rows, ['a', 'b', 'c']).size).toBe(0);
  });

  it('places a new row, and makes room between equal ranks', () => {
    const rows = [
      { id: 'a', rank: 'a1' },
      { id: 'b', rank: 'a2' },
      { id: 'c', rank: 'a2' },
    ];
    const changes = planRankChanges(rows, ['a', 'b', 'new', 'c']);
    expect(changes.has('new')).toBe(true);
    const after = [...applyChanges(rows, changes), { id: 'new', rank: changes.get('new')! }];
    expect(orderOf(after)).toEqual(['a', 'b', 'new', 'c']);
  });

  it('ranks rows with unusable keys again', () => {
    const rows = [
      { id: 'a', rank: '' },
      { id: 'b', rank: 'a1' },
      { id: 'c', rank: 'bad key' },
    ];
    const changes = planRankChanges(rows, ['c', 'a', 'b']);
    const after = applyChanges(rows, changes);
    expect(after.every((row) => isValidRank(row.rank))).toBe(true);
    expect(orderOf(after)).toEqual(['c', 'a', 'b']);
  });

  it('keeps rows it was not told about after the named ones', () => {
    const rows = ranked(['a', 'b', 'c', 'd']);
    const changes = planRankChanges(rows, ['c', 'a']);
    expect(orderOf(applyChanges(rows, changes))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('reaches any permutation, and keys stay short under repeated moves', () => {
    const next = random(11);
    let rows = ranked(
      Array.from({ length: 30 }, (_, index) => `r${String(index).padStart(2, '0')}`),
    );
    for (let step = 0; step < 2000; step += 1) {
      const desired = orderOf(rows);
      // The worst case for key growth: always the same row wedged into the same gap.
      const moved = desired.splice(Math.floor(next() * desired.length), 1)[0]!;
      const at = step % 2 === 0 ? 1 : Math.floor(next() * (desired.length + 1));
      desired.splice(at, 0, moved);
      const changes = planRankChanges(rows, desired);
      rows = applyChanges(rows, changes);
      expect(orderOf(rows)).toEqual(desired);
      expect(rows.every((row) => row.rank.length <= MAX_RANK_LENGTH)).toBe(true);
    }
  });
});

describe('derivePositions', () => {
  it('numbers live rows per container from the entity base', () => {
    const scenes = [
      { id: 's1', rank: 'a2', isDeleted: false, chapterId: 'c1' },
      { id: 's2', rank: 'a1', isDeleted: false, chapterId: 'c1' },
      { id: 's3', rank: 'a1', isDeleted: true, chapterId: 'c1' },
      { id: 's4', rank: 'a1', isDeleted: false, chapterId: null },
    ];
    const positions = derivePositions('Scene', scenes);
    expect(Object.fromEntries(positions)).toEqual({ s2: 1, s1: 2, s3: 0, s4: 1 });
    const stats = derivePositions('Stat', [
      { id: 'b', rank: 'a1', isDeleted: false },
      { id: 'a', rank: 'a1', isDeleted: false },
    ]);
    expect(Object.fromEntries(stats)).toEqual({ a: 0, b: 1 });
  });
});
