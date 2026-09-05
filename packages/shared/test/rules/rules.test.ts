import { describe, expect, it } from 'vitest';
import { isSameEntity, SELF_LINK_ERROR, sortEntityPair } from '../../rules/entityPair';
import { scenesToUnflag } from '../../rules/linearStoryScenes';
import {
  buildReorderItems,
  completeReorderProblem,
  reorderIndicesProblem,
} from '../../rules/reorderIndices';
import { ownerOnlyFieldsIn, STORY_OWNER_ONLY_FIELDS } from '../../rules/storyOwnerFields';

/**
 * The rules that hold on both sides of synchronization. Each of them once existed written twice -
 * client and server - and the test lives here precisely so there is a single place where the rule is
 * asserted.
 */
describe('start and end scenes in a linear story', () => {
  it('unflags nothing when there is already at most one of each', () => {
    expect(
      scenesToUnflag([
        { id: 'a', isStart: true, isFinish: false },
        { id: 'b', isStart: false, isFinish: false },
        { id: 'c', isStart: false, isFinish: true },
      ]),
    ).toEqual({ start: [], finish: [] });
  });

  it('keeps the first one and unflags the repeats', () => {
    expect(
      scenesToUnflag([
        { id: 'a', isStart: true },
        { id: 'b', isStart: true },
        { id: 'c', isStart: true },
      ]).start,
    ).toEqual(['b', 'c']);
  });

  it('treats start and end independently', () => {
    const { start, finish } = scenesToUnflag([
      { id: 'a', isStart: true, isFinish: true },
      { id: 'b', isStart: true, isFinish: false },
      { id: 'c', isStart: false, isFinish: true },
    ]);

    expect(start).toEqual(['b']);
    expect(finish).toEqual(['c']);
  });

  it('accepts a scene with the flags undefined', () => {
    expect(scenesToUnflag([{ id: 'a' }, { id: 'b' }])).toEqual({ start: [], finish: [] });
  });
});

describe('reorder indices', () => {
  it('accepts a contiguous 1..N', () => {
    expect(reorderIndicesProblem([1, 2, 3])).toBeNull();
    expect(reorderIndicesProblem([3, 1, 2])).toBeNull();
  });

  it('refuses a repeated index', () => {
    expect(reorderIndicesProblem([1, 2, 2])).toContain('Duplicate');
  });

  it('refuses a list that does not start at 1', () => {
    expect(reorderIndicesProblem([0, 1, 2])).toContain('sequential');
    expect(reorderIndicesProblem([2, 3, 4])).toContain('sequential');
  });

  it('refuses a hole in the middle', () => {
    expect(reorderIndicesProblem([1, 2, 4, 5])).toContain('sequential');
  });

  it('has nothing to complain about in an empty list', () => {
    expect(reorderIndicesProblem([])).toBeNull();
  });

  /** The producer and the validator have to agree: that is the point of having both here. */
  it('produces a list the validator itself accepts', () => {
    const items = buildReorderItems(['x', 'y', 'z'], (id) => id);

    expect(items).toEqual([
      { id: 'x', newIndex: 1 },
      { id: 'y', newIndex: 2 },
      { id: 'z', newIndex: 3 },
    ]);
    expect(reorderIndicesProblem(items.map((item) => item.newIndex))).toBeNull();
  });

  it('requires every expected ID exactly once as well as contiguous indices', () => {
    expect(
      completeReorderProblem(
        ['a', 'b'],
        [
          { id: 'a', newIndex: 1 },
          { id: 'b', newIndex: 2 },
        ],
      ),
    ).toBeNull();
    expect(
      completeReorderProblem(
        ['a'],
        [
          { id: 'a', newIndex: 1 },
          { id: 'a', newIndex: 2 },
        ],
      ),
    ).toContain('exactly once');
  });
});

describe('unordered entity pair', () => {
  it('sorts the pair the same way whatever order it arrives in', () => {
    const a = { type: 'Character', id: '2' };
    const b = { type: 'Location', id: '1' };

    expect(sortEntityPair(a, b)).toEqual(sortEntityPair(b, a));
  });

  it('breaks the tie by id when the type is the same', () => {
    const [first] = sortEntityPair({ type: 'Note', id: 'b' }, { type: 'Note', id: 'a' });

    expect(first.id).toBe('a');
  });

  it('recognises an entity linked to itself', () => {
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Note', id: 'a' })).toBe(true);
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Note', id: 'b' })).toBe(false);
    expect(isSameEntity({ type: 'Note', id: 'a' }, { type: 'Item', id: 'a' })).toBe(false);
    expect(SELF_LINK_ERROR).toContain('itself');
  });
});

describe('fields only the owner changes', () => {
  it('includes the story identity and policy', () => {
    expect([...STORY_OWNER_ONLY_FIELDS]).toEqual([
      'id',
      'userId',
      'type',
      'favoriteBehavior',
      'allowReaderComments',
    ]);
  });

  it('points out the restricted fields present in a change', () => {
    expect(ownerOnlyFieldsIn({ title: 'x', type: 'linear' })).toEqual(['type']);
    expect(ownerOnlyFieldsIn({ title: 'x' })).toEqual([]);
    expect(ownerOnlyFieldsIn(undefined)).toEqual([]);
  });

  /** `undefined` is "untouched"; `null` is a change and has to be blocked. */
  it('counts null as an attempted change', () => {
    expect(ownerOnlyFieldsIn({ favoriteBehavior: null })).toEqual(['favoriteBehavior']);
  });
});
