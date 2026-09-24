import { describe, expect, it } from 'vitest';
import {
  buildReorderItems,
  completeReorderProblem,
  inspectContiguousOneBasedIndexes,
  reorderIndicesProblem,
  sameReorderArrangement,
} from '../../rules/reorderIndices';

describe('reorder index rules', () => {
  it('classifies every persisted contiguous-index failure', () => {
    expect(inspectContiguousOneBasedIndexes([])).toBeNull();
    expect(inspectContiguousOneBasedIndexes([1, 1])).toBe('duplicate');
    expect(inspectContiguousOneBasedIndexes([2, 3])).toBe('start');
    expect(inspectContiguousOneBasedIndexes([1, 3])).toBe('gap');
    expect(inspectContiguousOneBasedIndexes([3, 1, 2])).toBeNull();
  });

  it('creates and validates full, contiguous reorder payloads', () => {
    const items = buildReorderItems(['b', 'a'], (id) => id);
    expect(items).toEqual([
      { id: 'b', newIndex: 1 },
      { id: 'a', newIndex: 2 },
    ]);
    expect(reorderIndicesProblem([])).toBeNull();
    expect(reorderIndicesProblem([1, 1])).toMatch(/Duplicate/);
    expect(reorderIndicesProblem([1, 3])).toMatch(/sequential/);
    expect(completeReorderProblem(['a', 'b'], items)).toBeNull();
    expect(completeReorderProblem(['a', 'b'], [{ id: 'a', newIndex: 1 }])).toMatch(
      /every expected/,
    );
  });

  it('recognizes the same arrangement whatever order the lists arrive in', () => {
    const first = [
      { id: 'a', newIndex: 1 },
      { id: 'b', newIndex: 2 },
    ];
    expect(sameReorderArrangement(first, first)).toBe(true);
    expect(
      sameReorderArrangement(first, [
        { id: 'b', newIndex: 2 },
        { id: 'a', newIndex: 1 },
      ]),
    ).toBe(true);
    expect(sameReorderArrangement(first, [{ id: 'a', newIndex: 1 }])).toBe(false);
    expect(
      sameReorderArrangement(first, [
        { id: 'a', newIndex: 2 },
        { id: 'b', newIndex: 1 },
      ]),
    ).toBe(false);
    expect(
      sameReorderArrangement(
        [
          { id: 'a', newIndex: 1 },
          { id: 'a', newIndex: 1 },
        ],
        first,
      ),
    ).toBe(false);
    // Duplicates on the right match one entry twice while dropping another: the same
    // length, a different arrangement - and the wire side is the untrusted one.
    expect(
      sameReorderArrangement(first, [
        { id: 'a', newIndex: 1 },
        { id: 'a', newIndex: 1 },
      ]),
    ).toBe(false);
  });
});
