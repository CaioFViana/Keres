import { describe, expect, it } from 'vitest';
import {
  buildChronologyLayout,
  type ChronologyContainer,
  type ChronologyRelation,
} from '../../graphs/chronologyLayout';

/**
 * Arranging containers by when they happened.
 *
 * The input is a **partial order**: most pairs have nothing stated about them, and that is the
 * normal case rather than missing data. So the shape these assert is bands - not a sequence - and
 * above all that the drawing never invents an order nobody stated, and never spins on a
 * contradiction the writer is entitled to have made.
 */

let nextIndex = 1;
const container = (id: string, isEvent = true): ChronologyContainer => ({
  id,
  name: id,
  isEvent,
  index: nextIndex++,
});

const before = (a: string, b: string): ChronologyRelation => ({
  chapter1Id: a,
  chapter2Id: b,
  relationType: 'before',
});

const bandOf = (layout: ReturnType<typeof buildChronologyLayout>, id: string) =>
  layout.nodes.find((node) => node.id === id)?.band;

describe('placing containers in bands', () => {
  it('puts a chain in one band per step', () => {
    const layout = buildChronologyLayout(
      ['a', 'b', 'c'].map((id) => container(id)),
      [before('a', 'b'), before('b', 'c')],
    );

    expect([bandOf(layout, 'a'), bandOf(layout, 'b'), bandOf(layout, 'c')]).toEqual([0, 1, 2]);
    expect(layout.bandCount).toBe(3);
  });

  /**
   * The longest path, not the shortest. `a` precedes both `b` and `c`, and `b` also precedes `c`,
   * so `c` waits for the later of the two - otherwise its arrow from `b` would point sideways.
   */
  it('waits for the latest thing that precedes it', () => {
    const layout = buildChronologyLayout(
      ['a', 'b', 'c'].map((id) => container(id)),
      [before('a', 'b'), before('a', 'c'), before('b', 'c')],
    );

    expect(bandOf(layout, 'c')).toBe(2);
  });

  /** Two things in one band are not simultaneous - they are unrelated, which is the truth. */
  it('leaves unrelated containers side by side', () => {
    const layout = buildChronologyLayout(
      ['a', 'b', 'root'].map((id) => container(id)),
      [before('root', 'a'), before('root', 'b')],
    );

    expect(bandOf(layout, 'a')).toBe(1);
    expect(bandOf(layout, 'b')).toBe(1);
    expect(layout.nodes.filter((node) => node.band === 1).map((node) => node.slot)).toEqual([0, 1]);
  });

  /**
   * "Nothing is known to come before this" is a claim; "nobody mentioned it" is not. Dropping a
   * never-mentioned container into band 0 would say the first when the truth is the second.
   */
  it('lists a container nobody mentioned apart from the bands', () => {
    const layout = buildChronologyLayout(
      ['a', 'b', 'lonely'].map((id) => container(id)),
      [before('a', 'b')],
    );

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b']);
    expect(layout.unplaced.map((node) => node.id)).toEqual(['lonely']);
  });
});

describe('unordered relations', () => {
  /** Things sharing time say nothing about sequence, so they place no container after another. */
  it.each(['overlaps', 'simultaneous'] as const)('does not band by %s', (relationType) => {
    const layout = buildChronologyLayout(
      ['a', 'b'].map((id) => container(id)),
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType }],
    );

    expect(bandOf(layout, 'a')).toBe(0);
    expect(bandOf(layout, 'b')).toBe(0);
  });

  it('still draws them as a tie between the two', () => {
    const layout = buildChronologyLayout(
      ['a', 'b'].map((id) => container(id)),
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'overlaps' }],
    );

    expect(layout.edges).toEqual([
      { fromId: 'a', toId: 'b', relationType: 'overlaps', directional: false },
    ]);
  });

  /** Being mentioned in any relation counts as being placed, even an unordered one. */
  it('counts them as mentioned', () => {
    const layout = buildChronologyLayout(
      ['a', 'b'].map((id) => container(id)),
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'simultaneous' }],
    );

    expect(layout.unplaced).toEqual([]);
  });
});

describe('a chronology that contradicts itself', () => {
  /**
   * A writer can state a loop, and this is very often the screen they are looking at when they find
   * out. It has to place them and carry on rather than spin or hide them.
   */
  it('places the containers of a loop instead of dropping them', () => {
    const layout = buildChronologyLayout(
      ['a', 'b', 'c'].map((id) => container(id)),
      [before('a', 'b'), before('b', 'c'), before('c', 'a')],
    );

    expect(layout.hasCycle).toBe(true);
    expect(layout.nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'c']);
    expect(layout.nodes.every((node) => node.inCycle)).toBe(true);
  });

  it('keeps the part that can be ordered in order', () => {
    const layout = buildChronologyLayout(
      ['start', 'a', 'b'].map((id) => container(id)),
      [before('start', 'a'), before('a', 'b'), before('b', 'a')],
    );

    expect(bandOf(layout, 'start')).toBe(0);
    expect(layout.nodes.find((node) => node.id === 'start')?.inCycle).toBe(false);
    expect(layout.nodes.find((node) => node.id === 'a')?.inCycle).toBe(true);
  });

  it('says nothing about a cycle when there is none', () => {
    const layout = buildChronologyLayout(
      ['a', 'b'].map((id) => container(id)),
      [before('a', 'b')],
    );

    expect(layout.hasCycle).toBe(false);
  });
});

describe('what it refuses to draw', () => {
  /** A relation to something outside the story would place a node with no name. */
  it('ignores a relation naming a container it was not given', () => {
    const layout = buildChronologyLayout([container('a')], [before('a', 'ghost')]);

    expect(layout.edges).toEqual([]);
    expect(layout.unplaced.map((node) => node.id)).toEqual(['a']);
  });

  it('handles a story with no containers at all', () => {
    const layout = buildChronologyLayout([], []);

    expect(layout).toMatchObject({ nodes: [], edges: [], bandCount: 0, hasCycle: false });
  });

  /**
   * A long chain must not overflow the stack. Kahn's algorithm is iterative for this reason - and
   * this is the screen a writer opens *because* something is wrong.
   */
  it('survives a chain thousands of containers long', () => {
    const ids = Array.from({ length: 5000 }, (_, index) => `c${index}`);
    const layout = buildChronologyLayout(
      ids.map((id) => container(id)),
      ids.slice(0, -1).map((id, index) => before(id, ids[index + 1]!)),
    );

    expect(layout.bandCount).toBe(5000);
    expect(layout.hasCycle).toBe(false);
  });
});

describe('what a node carries', () => {
  it('keeps the duration the caller worked out', () => {
    const layout = buildChronologyLayout(
      [
        { id: 'war', name: 'The war', isEvent: true, index: 1, durationLabel: '300 years' },
        container('end'),
      ],
      [before('war', 'end')],
    );

    expect(layout.nodes.find((node) => node.id === 'war')?.durationLabel).toBe('300 years');
  });

  it('remembers which containers are events', () => {
    const layout = buildChronologyLayout(
      [container('war', true), container('chapter-4', false)],
      [before('war', 'chapter-4')],
    );

    expect(layout.nodes.find((node) => node.id === 'chapter-4')?.isEvent).toBe(false);
  });
});

/**
 * Containment is not precedence.
 *
 * "A happens during B" says A sits inside B's span, not that A comes first. Read as precedence it
 * would draw the contained thing one step *earlier* than the thing containing it, which is the
 * opposite of what the writer wrote - and it would do so silently, because the picture would still
 * look orderly.
 */
describe('during', () => {
  const during = (a: string, b: string): ChronologyRelation => ({
    chapter1Id: a,
    chapter2Id: b,
    relationType: 'during',
  });

  it('places the contained at its container step, not before it', () => {
    const layout = buildChronologyLayout(
      ['war', 'skirmish'].map((id) => container(id)),
      [during('skirmish', 'war')],
    );

    expect(bandOf(layout, 'skirmish')).toBe(bandOf(layout, 'war'));
  });

  it('follows the container when the container is itself placed', () => {
    const layout = buildChronologyLayout(
      ['peace', 'war', 'skirmish'].map((id) => container(id)),
      [before('peace', 'war'), during('skirmish', 'war')],
    );

    expect(bandOf(layout, 'war')).toBe(1);
    expect(bandOf(layout, 'skirmish')).toBe(1);
  });

  /** Containment chains: a inside b inside c all sit at c's step. */
  it('follows a chain of containment', () => {
    const layout = buildChronologyLayout(
      ['era', 'war', 'skirmish'].map((id) => container(id)),
      [during('war', 'era'), during('skirmish', 'war')],
    );

    expect(bandOf(layout, 'skirmish')).toBe(bandOf(layout, 'era'));
  });

  /** It still constrains: two things inside each other is as impossible as two befores. */
  it('is still a contradiction when it loops', () => {
    const layout = buildChronologyLayout(
      ['a', 'b'].map((id) => container(id)),
      [during('a', 'b'), during('b', 'a')],
    );

    expect(layout.hasCycle).toBe(true);
  });

  it('does not spin on a loop of containment', () => {
    const ids = ['a', 'b', 'c'];
    const layout = buildChronologyLayout(
      ids.map((id) => container(id)),
      [during('a', 'b'), during('b', 'c'), during('c', 'a')],
    );

    expect(layout.nodes).toHaveLength(3);
  });
});

/**
 * The chapter numbering, read as an implied chronology.
 *
 * Chapter 2 happens after chapter 1 unless somebody says otherwise. Ignoring that would make the
 * writer state, pair by pair, what the numbers already say - and would draw a story whose chapters
 * all sit at step one, which is the opposite of informative.
 */
describe('the spine as an implied order', () => {
  const chapter = (id: string, index: number): ChronologyContainer => ({
    id,
    name: id,
    isEvent: false,
    index,
  });
  const event = (id: string, index = 1): ChronologyContainer => ({
    id,
    name: id,
    isEvent: true,
    index,
  });

  it('places chapters in their numbered order with nothing stated', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)],
      [],
      { storyType: 'linear' },
    );

    expect([bandOf(layout, 'c1'), bandOf(layout, 'c2'), bandOf(layout, 'c3')]).toEqual([0, 1, 2]);
  });

  /** There the index is not the order of reading, so it says nothing about the order of happening. */
  it('implies nothing in a branching story', () => {
    const layout = buildChronologyLayout([chapter('c1', 1), chapter('c2', 2)], [], {
      storyType: 'branching',
    });

    expect(layout.nodes).toEqual([]);
    expect(layout.unplaced.map((node) => node.id).sort()).toEqual(['c1', 'c2']);
  });

  /**
   * The flashback. "Chapter 3 happened before chapter 1" is the writer being more specific than the
   * numbering, not disagreeing with themselves - so the implied edge yields and this is not a cycle.
   */
  it('yields to a stated relation that reverses the numbering', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)],
      [{ chapter1Id: 'c3', chapter2Id: 'c1', relationType: 'before' }],
      { storyType: 'linear' },
    );

    expect(layout.hasCycle).toBe(false);
    expect(bandOf(layout, 'c3')!).toBeLessThan(bandOf(layout, 'c1')!);
  });

  it('names each step after the chapter that owns it', () => {
    const layout = buildChronologyLayout(
      [
        { id: 'c1', name: 'The Harbour', isEvent: false, index: 1 },
        { id: 'c2', name: 'The Fall', isEvent: false, index: 2 },
      ],
      [],
      { storyType: 'linear' },
    );

    expect(layout.steps.map((step) => step.chapterName)).toEqual(['The Harbour', 'The Fall']);
    expect(layout.steps.map((step) => step.chapterIndex)).toEqual([1, 2]);
  });

  /**
   * An event sharing a step does not take the chapter's name off it: the step is still that
   * chapter's position in the telling, and the event is one more thing standing there.
   */
  it('keeps the chapter name when an event shares the step', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), event('era')],
      [{ chapter1Id: 'era', chapter2Id: 'c1', relationType: 'simultaneous' }],
      { storyType: 'linear' },
    );

    expect(layout.steps[0]!.chapterName).toBe('c1');
  });

  /** Two chapters at one step have no single owner, so the counter is the honest label. */
  it('leaves a step unnamed when two chapters share it', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2)],
      [{ chapter1Id: 'c1', chapter2Id: 'c2', relationType: 'simultaneous' }],
      { storyType: 'branching' },
    );

    expect(layout.steps[0]?.chapterName).toBeUndefined();
  });
});

/**
 * A container occupies a span, not a point.
 *
 * An event can sit inside one chapter or run across several at once. Drawing it at the first alone
 * would say it ended when it did not, which is a claim the writer never made.
 */
describe('spanning several steps', () => {
  const chapter = (id: string, index: number): ChronologyContainer => ({
    id,
    name: id,
    isEvent: false,
    index,
  });
  const war: ChronologyContainer = { id: 'war', name: 'The war', isEvent: true, index: 1 };

  /**
   * The chapters are inside the era, which is how a writer says an era ran through that stretch.
   * The other direction - one thing inside several disjoint things - is not a statement anybody can
   * mean, so it is not what "across several chapters" translates to.
   */
  const containing = (...chapterIds: string[]) =>
    buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), war],
      chapterIds.map((chapterId) => ({
        chapter1Id: chapterId,
        chapter2Id: 'war',
        relationType: 'during' as const,
      })),
      { storyType: 'linear' },
    );

  it('grows to cover everything inside it', () => {
    const node = containing('c1', 'c2', 'c3').nodes.find((entry) => entry.id === 'war')!;

    expect(node.band).toBe(0);
    expect(node.bandEnd).toBe(2);
  });

  it('sits at one step when only one chapter is inside it', () => {
    const node = containing('c2').nodes.find((entry) => entry.id === 'war')!;

    expect(node.band).toBe(1);
    expect(node.bandEnd).toBe(1);
  });

  /** The contained can never reach past what contains it - that is what the word says. */
  it('clamps the contained to its container', () => {
    const layout = buildChronologyLayout(
      [
        chapter('c1', 1),
        chapter('c2', 2),
        war,
        { id: 'siege', name: 'A siege', isEvent: true, index: 2 },
      ],
      [
        { chapter1Id: 'c1', chapter2Id: 'war', relationType: 'during' },
        { chapter1Id: 'siege', chapter2Id: 'war', relationType: 'during' },
        { chapter1Id: 'siege', chapter2Id: 'c2', relationType: 'overlaps' },
      ],
      { storyType: 'linear' },
    );

    const warNode = layout.nodes.find((entry) => entry.id === 'war')!;
    const siege = layout.nodes.find((entry) => entry.id === 'siege')!;
    expect(siege.band).toBeGreaterThanOrEqual(warNode.band);
    expect(siege.bandEnd).toBeLessThanOrEqual(warNode.bandEnd);
  });

  it('widens for an overlap as well as for containment', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), war],
      [
        { chapter1Id: 'war', chapter2Id: 'c1', relationType: 'overlaps' },
        { chapter1Id: 'war', chapter2Id: 'c2', relationType: 'overlaps' },
      ],
      { storyType: 'linear' },
    );
    const node = layout.nodes.find((entry) => entry.id === 'war')!;

    expect(node.band).toBe(0);
    expect(node.bandEnd).toBe(1);
  });

  /** A chapter of the spine is one step wide: the numbering places it, nothing widens it. */
  it('keeps a chapter at a single step', () => {
    const layout = buildChronologyLayout(
      [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), war],
      [],
      { storyType: 'linear' },
    );
    const node = layout.nodes.find((entry) => entry.id === 'c2')!;

    expect(node.band).toBe(node.bandEnd);
  });
});
