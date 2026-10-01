import { describe, expect, it } from 'vitest';
import { buildReorderItems, inspectContiguousOneBasedIndexes } from '../../rules/reorderIndices';

describe('reorder index rules', () => {
  it('classifies every persisted contiguous-index failure', () => {
    expect(inspectContiguousOneBasedIndexes([])).toBeNull();
    expect(inspectContiguousOneBasedIndexes([1, 1])).toBe('duplicate');
    expect(inspectContiguousOneBasedIndexes([2, 3])).toBe('start');
    expect(inspectContiguousOneBasedIndexes([1, 3])).toBe('gap');
    expect(inspectContiguousOneBasedIndexes([3, 1, 2])).toBeNull();
  });

  it('builds a dragged order 1..N', () => {
    expect(buildReorderItems(['b', 'a'], (id) => id)).toEqual([
      { id: 'b', newIndex: 1 },
      { id: 'a', newIndex: 2 },
    ]);
  });
});
