import { describe, expect, it } from 'vitest';
import { buildChronologyLayout } from '../../graphs/chronologyLayout';
import { renderChronologySvg } from '../../graphs/chronologySvg';

/**
 * The chronology drawn.
 *
 * What matters is not where a pixel lands but what the picture *asserts*: an arrow only where a
 * direction was stated, no arrow where none was, the contradiction visible rather than hidden, and
 * a writer's own words escaped rather than injected into the markup.
 */

const options = {
  subtitle: 'Each step is one thing the writer stated. Two rows at the same step are unrelated.',
  labels: {
    axis: 'Stated order - not clock time',
    step: 'Step',
    unplaced: 'Nothing stated about these',
    cycle: 'This chronology contradicts itself',
    ties: { during: 'during', overlaps: 'overlaps', simultaneous: 'same time' },
  },
  colors: {
    background: '#fff',
    surface: '#f5f5f5',
    text: '#111',
    textSecondary: '#555',
    border: '#ddd',
    primary: '#6200ee',
    warning: '#c00',
  },
};

const render = (
  containers: { id: string; name: string; isEvent?: boolean; durationLabel?: string }[],
  relations: { chapter1Id: string; chapter2Id: string; relationType: string }[],
  storyType: 'linear' | 'branching' = 'linear',
) =>
  renderChronologySvg(
    buildChronologyLayout(
      containers.map((container, index) => ({ isEvent: true, index: index + 1, ...container })),
      relations as never,
      { storyType },
    ),
    options,
  );

describe('what the drawing asserts', () => {
  /**
   * The axis is the story's stated order, and it says in words that it is not clock time. A partial
   * order has no real axis: spacing rows by duration would answer a question the writer never did.
   */
  it('names the axis as stated order rather than time', () => {
    const svg = render(
      [
        { id: 'a', name: 'The war' },
        { id: 'b', name: 'The peace' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    expect(svg).toContain('not clock time');
  });

  it('draws one step per stated position', () => {
    const svg = render(
      ['a', 'b', 'c'].map((id) => ({ id, name: id })),
      [
        { chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' },
        { chapter1Id: 'b', chapter2Id: 'c', relationType: 'before' },
      ],
    );

    expect(svg).toContain('Step 1');
    expect(svg).toContain('Step 3');
    expect(svg).not.toContain('Step 4');
  });

  /** Nothing was said about direction, so the two stay at the same step. */
  it.each(['overlaps', 'simultaneous'])('leaves %s at one step', (relationType) => {
    const svg = render(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType }],
    );

    expect(svg).toContain('Step 1');
    expect(svg).not.toContain('Step 2');
  });

  it('says in words that a shared step is not simultaneity', () => {
    const svg = render(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'overlaps' }],
    );
    expect(svg).toContain('unrelated');
  });

  /** The finding names it; the picture has to show it, since this is where they will be looking. */
  it('marks a contradiction on the drawing itself', () => {
    const svg = render(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      [
        { chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' },
        { chapter1Id: 'b', chapter2Id: 'a', relationType: 'during' },
      ],
    );

    expect(svg).toContain('contradicts itself');
    expect(svg).toContain(options.colors.warning);
  });

  /**
   * A row is as wide as the drawing, and the drawing is as wide as the axis. The unplaced block used
   * to lay cards out on a grid of its own and ran off the right edge of the document.
   */
  it('keeps every row inside the document', () => {
    const svg = render(
      ['a', 'b', 'lonely-1', 'lonely-2', 'lonely-3', 'lonely-4'].map((id) => ({ id, name: id })),
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    const width = Number(/width="(\d+)"/.exec(svg)![1]);
    const rights = [...svg.matchAll(/<rect x="(\d+)"[^>]*width="(\d+)"/g)].map(
      (match) => Number(match[1]) + Number(match[2]),
    );
    expect(Math.max(...rights)).toBeLessThanOrEqual(width);
  });

  it('lists the containers nobody mentioned, apart', () => {
    const svg = render(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'lonely', name: 'Unmentioned era' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    expect(svg).toContain('Nothing stated about these');
    expect(svg).toContain('Unmentioned era');
  });

  it('marks an event with the same hourglass the lists use', () => {
    const svg = render(
      [
        { id: 'a', name: 'The war', isEvent: true },
        { id: 'b', name: 'Chapter 4', isEvent: false },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    expect(svg).toContain('⏳ The war');
    expect(svg).toContain('>Chapter 4<');
  });

  it('shows a duration when the caller worked one out', () => {
    const svg = render(
      [
        { id: 'a', name: 'The war', durationLabel: '300 years' },
        { id: 'b', name: 'After' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    expect(svg).toContain('300 years');
  });
});

/**
 * Everything the axis cannot say.
 *
 * A step only carries `before`. Containment and the two unordered kinds are real statements that
 * the axis has no way to express - without a mark of their own the writer would state "the siege
 * happened during the war" and watch the drawing not change, which reads as the app ignoring them.
 */
describe('the axis reads as the story', () => {
  const spine = [
    { id: 'c1', name: 'The Harbour', isEvent: false },
    { id: 'c2', name: 'The Fall', isEvent: false },
  ];

  /**
   * The step is the chapter. That is the point of seeding from the numbering: a writer reads their
   * own chapter names across the top rather than a counter that means nothing to them.
   */
  it('names a step after the chapter that owns it', () => {
    const svg = render(spine, []);

    expect(svg).toContain('1. The Harbour');
    expect(svg).toContain('2. The Fall');
  });

  it('falls back to the counter for a step no chapter owns', () => {
    const svg = render(
      [...spine, { id: 'era', name: 'An era', isEvent: true }],
      [{ chapter1Id: 'era', chapter2Id: 'c1', relationType: 'before' }],
    );

    expect(svg).toContain('Step 1');
  });

  /** Nothing is implied from a branching numbering, so nothing is named after it either. */
  it('names nothing from the numbering in a branching story', () => {
    const svg = render(spine, [], 'branching');

    expect(svg).not.toContain('1. The Harbour');
  });

  /**
   * An era running across several chapters is drawn across their steps. Drawn at the first alone it
   * would say the era ended when it did not - a claim the writer never made.
   */
  it('draws a bar across every step its container covers', () => {
    const widthsOf = (svg: string) =>
      [...svg.matchAll(/<rect x="\d+" y="\d+" width="(\d+)" height="20"/g)].map((match) =>
        Number(match[1]),
      );

    // The chapters are inside the era: that is how a writer says it ran through that stretch.
    const oneChapter = render(
      [...spine, { id: 'era', name: 'An era', isEvent: true }],
      [{ chapter1Id: 'c1', chapter2Id: 'era', relationType: 'during' }],
    );
    const both = render(
      [...spine, { id: 'era', name: 'An era', isEvent: true }],
      [
        { chapter1Id: 'c1', chapter2Id: 'era', relationType: 'during' },
        { chapter1Id: 'c2', chapter2Id: 'era', relationType: 'during' },
      ],
    );

    expect(Math.max(...widthsOf(both))).toBeGreaterThan(Math.max(...widthsOf(oneChapter)));
  });
});

describe('relations the axis cannot carry', () => {
  const tie = (relationType: string) =>
    render(
      [
        { id: 'war', name: 'The war' },
        { id: 'siege', name: 'The siege' },
        { id: 'after', name: 'After' },
      ],
      [
        { chapter1Id: 'war', chapter2Id: 'after', relationType: 'before' },
        { chapter1Id: 'siege', chapter2Id: 'war', relationType },
      ],
    );

  it.each(['during', 'overlaps', 'simultaneous'])('draws a mark for %s', (relationType) => {
    const svg = tie(relationType);
    const phrase = { during: 'during', overlaps: 'overlaps', simultaneous: 'same time' }[
      relationType
    ]!;

    expect(svg).toContain(phrase);
    expect(svg).toContain('<path');
  });

  /** `before` is the axis itself; a bracket for it as well would say the same thing twice. */
  it('draws no mark for a relation the axis already shows', () => {
    const svg = render(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );

    expect(svg).not.toContain('<path');
  });

  /** Containment places the contained at its container's step, so the two share a row position. */
  it('leaves a contained container at its container step', () => {
    const svg = tie('during');
    expect(svg).toContain('Step 2');
    expect(svg).not.toContain('Step 3');
  });
});

describe('the markup itself', () => {
  /**
   * A container's name is the writer's text and must not be able to close a tag. Short enough to
   * survive the label truncation, which happens on the raw text *before* escaping - the other order
   * would let a cut land inside an entity and produce broken markup.
   */
  it('escapes a name that looks like markup', () => {
    const svg = render([{ id: 'a', name: '<b>x</b> & co' }], []);

    expect(svg).not.toContain('<b>x</b>');
    expect(svg).toContain('&lt;b&gt;');
    expect(svg).toContain('&amp; co');
  });

  it('produces a well-formed document for an empty story', () => {
    const svg = render([], []);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  /** Wider with more steps, taller with more containers: the two axes are what they say. */
  it('grows sideways with the stated order and downwards with the containers', () => {
    const shortChain = render(
      ['a', 'b'].map((id) => ({ id, name: id })),
      [{ chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' }],
    );
    const longChain = render(
      ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id })),
      [
        { chapter1Id: 'a', chapter2Id: 'b', relationType: 'before' },
        { chapter1Id: 'b', chapter2Id: 'c', relationType: 'before' },
        { chapter1Id: 'c', chapter2Id: 'd', relationType: 'before' },
      ],
    );

    const sizeOf = (svg: string) => {
      const match = /width="(\d+)" height="(\d+)"/.exec(svg)!;
      return { width: Number(match[1]), height: Number(match[2]) };
    };
    expect(sizeOf(longChain).width).toBeGreaterThan(sizeOf(shortChain).width);
    expect(sizeOf(longChain).height).toBeGreaterThan(sizeOf(shortChain).height);
  });
});
