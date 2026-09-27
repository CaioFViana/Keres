/**
 * @jest-environment node
 */
import {
  foldServerSnapshot,
  withoutDerivedPosition,
} from '../../src/services/sync/syncConflictHelpers';

describe('withoutDerivedPosition', () => {
  it("drops an arranged row's position: each device derives it from the rank", () => {
    expect(withoutDerivedPosition('Scene', { name: 'A', index: 3, rank: 'a3' })).toEqual({
      name: 'A',
      rank: 'a3',
    });
    expect(withoutDerivedPosition('Stat', { name: 'S', order: 0, rank: 'a1' })).toEqual({
      name: 'S',
      rank: 'a1',
    });
  });

  it('leaves entities without a derived position alone', () => {
    const values = { name: 'C', index: 3 };
    expect(withoutDerivedPosition('Character', values)).toBe(values);
    const scene = { name: 'A' };
    expect(withoutDerivedPosition('Scene', scene)).toBe(scene);
  });
});

describe('foldServerSnapshot', () => {
  it('merges newer values over older and takes the newer version', () => {
    const folded = foldServerSnapshot(
      { serverValues: JSON.stringify({ name: 'old', title: 'kept' }), serverVersion: 3 },
      { name: 'new' },
      5,
    );
    expect(folded).toEqual({
      serverValues: JSON.stringify({ name: 'new', title: 'kept' }),
      serverVersion: 5,
      stale: false,
    });
  });

  it('refuses an older snapshot and replaces with null when the entity is gone', () => {
    const held = { serverValues: JSON.stringify({ name: 'held' }), serverVersion: 5 };
    expect(foldServerSnapshot(held, { name: 'older' }, 4).stale).toBe(true);
    expect(foldServerSnapshot(held, null, 6)).toEqual({
      serverValues: null,
      serverVersion: 6,
      stale: false,
    });
  });
});
