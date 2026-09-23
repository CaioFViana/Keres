import type { ClippableContainer, ClippableRange } from '../../src/hooks/useWebSelectionClip';
import {
  clipRangeToContainer,
  readClippedSelection,
  trackSelectionContainer,
} from '../../src/hooks/useWebSelectionClip';

const BEFORE = { id: 'before' };
const INSIDE = { id: 'inside' };
const AFTER = { id: 'after' };

const container: ClippableContainer = {
  contains: (node: unknown) => node === INSIDE,
  childNodes: { length: 3 },
};

function stubRange(start: unknown, end: unknown, intersects: boolean) {
  const spies = { clone: jest.fn(), setStart: jest.fn(), setEnd: jest.fn() };
  const range: ClippableRange = {
    startContainer: start,
    endContainer: end,
    intersectsNode: () => intersects,
    cloneRange: () => {
      spies.clone();
      let clampedStart = start;
      let clampedEnd = end;
      return {
        get startContainer() {
          return clampedStart;
        },
        get endContainer() {
          return clampedEnd;
        },
        intersectsNode: () => intersects,
        cloneRange: () => {
          throw new Error('cloned twice');
        },
        setStart: (node: unknown, offset: number) => {
          spies.setStart(node, offset);
          clampedStart = node;
        },
        setEnd: (node: unknown, offset: number) => {
          spies.setEnd(node, offset);
          clampedEnd = node;
        },
        toString: () => {
          if (clampedStart === container && clampedEnd === container) return 'inside';
          if (clampedStart === BEFORE && clampedEnd === AFTER) return 'before inside after';
          if (clampedStart === BEFORE) return 'before inside';
          if (clampedEnd === AFTER) return 'inside after';
          return 'inside';
        },
      };
    },
    setStart: () => {
      throw new Error('uncalled clone');
    },
    setEnd: () => {
      throw new Error('uncalled clone');
    },
    toString: () => 'unclipped',
  };
  return { range, spies };
}

describe('clipRangeToContainer', () => {
  it('keeps a fully inside selection whole', () => {
    const { range, spies } = stubRange(INSIDE, INSIDE, true);

    expect(clipRangeToContainer(range, container)).toBe('inside');
    expect(spies.setStart).not.toHaveBeenCalled();
    expect(spies.setEnd).not.toHaveBeenCalled();
  });

  it('drops a fully outside selection', () => {
    const { range, spies } = stubRange(BEFORE, BEFORE, false);

    expect(clipRangeToContainer(range, container)).toBeNull();
    expect(spies.clone).not.toHaveBeenCalled();
  });

  it('clips a straddling selection to the within-field part', () => {
    const { range: left } = stubRange(BEFORE, INSIDE, true);
    expect(clipRangeToContainer(left, container)).toBe('inside');

    const { range: right } = stubRange(INSIDE, AFTER, true);
    expect(clipRangeToContainer(right, container)).toBe('inside');

    const { range: spanning, spies } = stubRange(BEFORE, AFTER, true);
    expect(clipRangeToContainer(spanning, container)).toBe('inside');
    expect(spies.setStart).toHaveBeenCalledWith(container, 0);
    expect(spies.setEnd).toHaveBeenCalledWith(container, 3);
  });

  it('clips an empty selection to null', () => {
    const { range } = stubRange(INSIDE, INSIDE, true);
    const empty: ClippableRange = {
      ...range,
      cloneRange: () => ({ ...range.cloneRange(), toString: () => '  ' }),
    };

    expect(clipRangeToContainer(empty, container)).toBeNull();
  });
});

describe('selection registry without a document', () => {
  it('tracks nothing and reads null outside web', () => {
    trackSelectionContainer('field', { contains: () => true, childNodes: { length: 0 } });

    expect(readClippedSelection('field')).toBeNull();
  });
});
