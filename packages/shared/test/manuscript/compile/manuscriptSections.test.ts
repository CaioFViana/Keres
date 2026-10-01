import { describe, expect, it } from 'vitest';
import {
  findManuscriptMatches,
  gamebookManuscriptSections,
  gamebookStartScenes,
  isLooseScene,
  linearManuscriptSections,
  locateOrdinalMatch,
  routeManuscriptSections,
  sectionIndexForMatch,
  type ManuscriptChapter,
  type ManuscriptRouteStep,
  type ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';

function makeChapter(overrides: Partial<ManuscriptChapter> = {}): ManuscriptChapter {
  return { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter', ...overrides };
}

function makeScene(overrides: Partial<ManuscriptScene> = {}): ManuscriptScene {
  return {
    id: 'scene-1',
    chapterId: 'ch-1',
    name: 'Opening',
    index: 1,
    body: null,
    isDeleted: false,
    ...overrides,
  };
}

function makeStep(overrides: Partial<ManuscriptRouteStep> = {}): ManuscriptRouteStep {
  return {
    id: 'step-1',
    routeId: 'route-1',
    position: 1,
    sceneId: 'scene-1',
    isDeleted: false,
    ...overrides,
  };
}

describe('isLooseScene', () => {
  const chaptersById = new Map([
    ['ch-1', { type: 'chapter' as const }],
    ['ev-1', { type: 'event' as const }],
  ]);

  it.each([
    [{ chapterId: null }, true],
    [{ chapterId: 'ch-1' }, false],
    [{ chapterId: 'ev-1' }, true],
    [{ chapterId: 'gone' }, true],
  ])('classifies %p as loose=%p', (scene, expected) => {
    expect(isLooseScene(scene, chaptersById)).toBe(expected);
  });
});

describe('linearManuscriptSections', () => {
  it('orders chapters with their scenes by index', () => {
    const sections = linearManuscriptSections(
      [makeChapter({ id: 'ch-2', name: 'Second', index: 2 }), makeChapter()],
      [
        makeScene({ id: 's-2', chapterId: 'ch-2', index: 1, name: 'B' }),
        makeScene({ id: 's-1b', chapterId: 'ch-1', index: 2, name: 'A2' }),
        makeScene({ id: 's-1a', chapterId: 'ch-1', index: 1, name: 'A1' }),
      ],
    );

    expect(
      sections.map((s) =>
        s.kind === 'scene'
          ? `scene:${s.scene.id}#${s.position}`
          : s.kind === 'container'
            ? `container:${s.name}`
            : 'loose-heading',
      ),
    ).toEqual([
      'container:Arrival',
      'scene:s-1a#1',
      'scene:s-1b#2',
      'container:Second',
      'scene:s-2#3',
    ]);
  });

  it('puts event containers after chapters and the homeless last', () => {
    const sections = linearManuscriptSections(
      [makeChapter(), makeChapter({ id: 'ev-1', name: 'Quake', index: 1, type: 'event' })],
      [
        makeScene({ id: 's-loose', chapterId: null, name: 'Fragment' }),
        makeScene({ id: 's-ev', chapterId: 'ev-1', name: 'Tremor' }),
        makeScene({ id: 's-ch', chapterId: 'ch-1', name: 'Main' }),
      ],
    );

    expect(sections.map((s) => (s.kind === 'scene' ? s.scene.id : s.kind))).toEqual([
      'container',
      's-ch',
      'container',
      's-ev',
      'loose-heading',
      's-loose',
    ]);
    expect(sections[2]).toMatchObject({ kind: 'container', containerType: 'event' });
  });

  it('skips empty containers, deleted scenes and the loose heading without homeless', () => {
    const sections = linearManuscriptSections(
      [makeChapter(), makeChapter({ id: 'ch-empty', name: 'Empty', index: 2 })],
      [makeScene(), makeScene({ id: 's-gone', chapterId: 'ch-1', index: 2, isDeleted: true })],
    );

    expect(sections.map((s) => s.kind)).toEqual(['container', 'scene']);
  });

  it('treats scenes of gone chapters as homeless', () => {
    const sections = linearManuscriptSections(
      [makeChapter()],
      [makeScene({ id: 's-orphan', chapterId: 'gone' })],
    );

    expect(sections.map((s) => s.kind)).toEqual(['loose-heading', 'scene']);
  });
});

describe('routeManuscriptSections', () => {
  it('follows step positions and numbers scenes', () => {
    const sections = routeManuscriptSections(
      [
        makeStep({ id: 'step-2', position: 2, sceneId: 's-b' }),
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
      ],
      [makeScene({ id: 's-a', name: 'A' }), makeScene({ id: 's-b', name: 'B' })],
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ key: 'step-step-1', kind: 'scene', position: 1 });
    expect(sections[1]).toMatchObject({ key: 'step-step-2', kind: 'scene', position: 2 });
  });

  it('keys repeated scenes by step and skips the vanished', () => {
    const sections = routeManuscriptSections(
      [
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
        makeStep({ id: 'step-2', position: 2, sceneId: 's-gone' }),
        makeStep({ id: 'step-3', position: 3, sceneId: 's-a' }),
        makeStep({ id: 'step-4', position: 4, sceneId: 's-a', isDeleted: true }),
      ],
      [makeScene({ id: 's-a', name: 'A' })],
    );

    expect(sections.map((s) => s.key)).toEqual(['step-step-1', 'step-step-3']);
  });
});

describe('gamebookManuscriptSections', () => {
  const scene = (id: string, overrides: Partial<ManuscriptScene> = {}) =>
    makeScene({ id, name: id, chapterId: null, ...overrides });
  const go = (from: string, to: string) => ({ sceneId: from, nextSceneId: to });
  const ids = (sections: ReturnType<typeof gamebookManuscriptSections>) =>
    sections.map((section) => (section.kind === 'scene' ? section.scene.id : section.kind));

  it('numbers by breadth-first search from the start scene, strays last', () => {
    const sections = gamebookManuscriptSections(
      [scene('a', { index: 5 }), scene('b', { isStart: true }), scene('c'), scene('d'), scene('e')],
      [go('b', 'c'), go('b', 'a'), go('c', 'd'), go('a', 'd'), go('d', 'b')],
      { order: 'discovery' },
    );

    expect(ids(sections)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(sections.map((section) => (section as { position: number }).position)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('reaches from every start, not only the first, and keeps the strays after', () => {
    const scenes = [
      scene('a', { isStart: true, index: 1 }),
      scene('b', { isStart: true, index: 2 }),
      scene('c', { index: 3 }),
      scene('lost', { index: 4 }),
    ];

    const sections = gamebookManuscriptSections(scenes, [go('b', 'c')], { order: 'discovery' });

    expect(ids(sections)).toEqual(['a', 'b', 'c', 'lost']);
    expect(gamebookStartScenes(scenes).map((start) => start.id)).toEqual(['a', 'b']);
  });

  it('scatters several starts too, but keeps a lone start first', () => {
    const many = (starts: number) =>
      Array.from({ length: 10 }, (_, index) =>
        scene(`s${index}`, { index, isStart: index < starts }),
      );
    const links = Array.from({ length: 9 }, (_, index) => go(`s${index}`, `s${index + 1}`));

    expect(ids(gamebookManuscriptSections(many(1), links, { order: 'shuffled' }))[0]).toBe('s0');
    const several = ids(
      gamebookManuscriptSections(many(3), links, { order: 'shuffled', seed: 'x' }),
    );
    expect(several).not.toEqual(['s0', 's1', 's2', ...several.slice(3)]);
    expect([...several].sort()).toEqual(
      many(3)
        .map((each) => each.id)
        .sort(),
    );
  });

  it('starts at the first scene by index when none is flagged', () => {
    const sections = gamebookManuscriptSections(
      [scene('late', { index: 9 }), scene('early', { index: 1 })],
      [go('early', 'late')],
      { order: 'discovery' },
    );
    expect(ids(sections)).toEqual(['early', 'late']);
  });

  it('skips deleted scenes and choices into scenes it was not given', () => {
    const sections = gamebookManuscriptSections(
      [scene('a', { isStart: true }), scene('gone', { isDeleted: true })],
      [go('a', 'gone'), go('a', 'elsewhere')],
      { order: 'discovery' },
    );
    expect(ids(sections)).toEqual(['a']);
  });

  it('has nothing to number without scenes', () => {
    expect(gamebookManuscriptSections([], [], { order: 'shuffled' })).toEqual([]);
  });

  it('defaults the shuffle seed to the start scene, so a book reprints the same', () => {
    const chain = Array.from({ length: 10 }, (_, index) =>
      scene(`s${index}`, { isStart: index === 0 }),
    );
    const links = chain.slice(1).map((next, index) => go(chain[index].id, next.id));
    const first = gamebookManuscriptSections(chain, links, { order: 'shuffled' });
    const second = gamebookManuscriptSections(chain, links, { order: 'shuffled' });
    expect(ids(first)).toEqual(ids(second));
    expect(ids(first)[0]).toBe('s0');
  });
});

describe('findManuscriptMatches', () => {
  const sections = linearManuscriptSections(
    [makeChapter()],
    [
      makeScene({ id: 's-1', name: 'The Harbor', body: 'Waves. Waves again.' }),
      makeScene({ id: 's-2', name: 'Inland', index: 2, body: 'No water.' }),
    ],
  );

  it('returns nothing for a blank query', () => {
    expect(findManuscriptMatches(sections, '  ')).toEqual({ matches: [], total: 0 });
  });

  it('counts case-insensitive occurrences across names and bodies', () => {
    expect(findManuscriptMatches(sections, 'waves')).toEqual({
      matches: [{ sectionIndex: 1, count: 2 }],
      total: 2,
    });
    expect(findManuscriptMatches(sections, 'HARBOR')).toEqual({
      matches: [{ sectionIndex: 1, count: 1 }],
      total: 1,
    });
    expect(findManuscriptMatches(sections, 'water')).toEqual({
      matches: [{ sectionIndex: 2, count: 1 }],
      total: 1,
    });
  });

  it('maps ordinals back to sections', () => {
    const { matches } = findManuscriptMatches(sections, 'a');
    expect(matches.length).toBeGreaterThan(0);
    expect(sectionIndexForMatch(matches, 0)).toBe(matches[0].sectionIndex);
    const total = matches.reduce((sum, m) => sum + m.count, 0);
    expect(sectionIndexForMatch(matches, total - 1)).toBe(matches[matches.length - 1].sectionIndex);
  });
});

describe('locateOrdinalMatch', () => {
  const sections = linearManuscriptSections(
    [makeChapter()],
    [
      makeScene({ id: 's-1', name: 'The Harbor', body: 'Waves. Waves again.' }),
      makeScene({ id: 's-2', name: 'Inland Waves', index: 2, body: 'No water.' }),
    ],
  );

  it('returns null without matches or with an out-of-range ordinal', () => {
    const { matches } = findManuscriptMatches(sections, 'waves');
    expect(locateOrdinalMatch(sections, [], 'waves', 0)).toBeNull();
    expect(locateOrdinalMatch(sections, matches, 'waves', -1)).toBeNull();
    expect(locateOrdinalMatch(sections, matches, 'waves', 99)).toBeNull();
  });

  it('locates body hits with a 0-based index inside the body', () => {
    const { matches } = findManuscriptMatches(sections, 'waves');
    expect(locateOrdinalMatch(sections, matches, 'waves', 0)).toEqual({
      sectionIndex: 1,
      nameMatchIndex: -1,
      bodyMatchIndex: 0,
    });
    expect(locateOrdinalMatch(sections, matches, 'waves', 1)).toEqual({
      sectionIndex: 1,
      nameMatchIndex: -1,
      bodyMatchIndex: 1,
    });
  });

  it('counts name hits first, then offsets the body index past them', () => {
    const { matches } = findManuscriptMatches(sections, 'inland waves');
    expect(matches).toEqual([{ sectionIndex: 2, count: 1 }]);
    expect(locateOrdinalMatch(sections, matches, 'inland waves', 0)).toEqual({
      sectionIndex: 2,
      nameMatchIndex: 0,
      bodyMatchIndex: -1,
    });
  });

  it('walks into later sections past earlier counts', () => {
    const { matches } = findManuscriptMatches(sections, 'waves');
    // Two body hits in s-1, one name hit in s-2.
    expect(locateOrdinalMatch(sections, matches, 'waves', 2)).toEqual({
      sectionIndex: 2,
      nameMatchIndex: 0,
      bodyMatchIndex: -1,
    });
  });
});
