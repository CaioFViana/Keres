import { describe, expect, it } from 'vitest';
import {
  findManuscriptMatches,
  isLooseScene,
  linearManuscriptSections,
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
    ).toEqual(['container:Arrival', 'scene:s-1a#1', 'scene:s-1b#2', 'container:Second', 'scene:s-2#3']);
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

    expect(
      sections.map((s) => (s.kind === 'scene' ? s.scene.id : s.kind)),
    ).toEqual(['container', 's-ch', 'container', 's-ev', 'loose-heading', 's-loose']);
    expect(sections[2]).toMatchObject({ kind: 'container', containerType: 'event' });
  });

  it('skips empty containers, deleted scenes and the loose heading without homeless', () => {
    const sections = linearManuscriptSections(
      [makeChapter(), makeChapter({ id: 'ch-empty', name: 'Empty', index: 2 })],
      [
        makeScene(),
        makeScene({ id: 's-gone', chapterId: 'ch-1', index: 2, isDeleted: true }),
      ],
    );

    expect(sections.map((s) => s.kind)).toEqual(['container', 'scene']);
  });

  it('treats scenes of gone chapters as homeless', () => {
    const sections = linearManuscriptSections([makeChapter()], [
      makeScene({ id: 's-orphan', chapterId: 'gone' }),
    ]);

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
