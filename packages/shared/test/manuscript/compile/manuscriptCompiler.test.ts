import { describe, expect, it } from 'vitest';
import {
  bookmarkIdForChapter,
  bookmarkIdForScene,
  compileLinearManuscript,
  compileRouteManuscript,
  manuscriptTocEntries,
  withoutLooseSections,
  type CompiledBlock,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  linearManuscriptSections,
  type ManuscriptChapter,
  type ManuscriptRouteStep,
  type ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';

function makeChapter(overrides: Partial<ManuscriptChapter> = {}): ManuscriptChapter {
  return { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter', ...overrides };
}

function makeScene(overrides: Partial<ManuscriptScene> = {}): ManuscriptScene {
  return {
    id: 's-1',
    chapterId: 'ch-1',
    name: 'Opening',
    index: 1,
    body: 'First line.\n\nSecond **bold** line.',
    isDeleted: false,
    ...overrides,
  };
}

function makeChoice(overrides: Partial<ManuscriptChoice> = {}): ManuscriptChoice {
  return { id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Go on', ...overrides };
}

function makeStep(overrides: Partial<ManuscriptRouteStep> = {}): ManuscriptRouteStep {
  return {
    id: 'step-1',
    routeId: 'route-1',
    position: 1,
    sceneId: 's-a',
    isDeleted: false,
    ...overrides,
  };
}

function kinds(blocks: CompiledBlock[]): string[] {
  return blocks.map((block) => block.kind);
}

describe('bookmarkIdForScene', () => {
  it('builds Word-safe bookmark names', () => {
    expect(bookmarkIdForScene('01JABC')).toBe('scene-01JABC');
    expect(bookmarkIdForScene('a b.c-d')).toBe('scene-abcd');
    expect(bookmarkIdForScene('x'.repeat(100)).length).toBeLessThanOrEqual(40);
  });
});

describe('compileLinearManuscript', () => {
  const chapters = [makeChapter()];
  const scenes = [
    makeScene(),
    makeScene({ id: 's-2', name: 'Next', index: 2, body: 'After.' }),
    makeScene({ id: 's-loose', name: 'Note', index: 3, chapterId: null, body: 'Aside.' }),
  ];

  it('compiles title, chapters, scenes, bodies and choices', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [makeChoice()],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });

    expect(manuscript.title).toBe('My Story');
    expect(kinds(manuscript.blocks)).toEqual([
      'title',
      'chapter',
      'scene-heading',
      'paragraph',
      'paragraph',
      'choice',
      'scene-heading',
      'paragraph',
      'loose-heading',
      'scene-heading',
      'paragraph',
    ]);
    const heading = manuscript.blocks[2];
    expect(heading).toMatchObject({ kind: 'scene-heading', number: 1, bookmarkId: 'scene-s1' });
    const paragraph = manuscript.blocks[4];
    expect(paragraph).toMatchObject({
      kind: 'paragraph',
      spans: [
        { text: 'Second ', bold: false, italic: false },
        { text: 'bold', bold: true, italic: false },
        { text: ' line.', bold: false, italic: false },
      ],
    });
    expect(manuscript.blocks[5]).toMatchObject({
      kind: 'choice',
      text: 'Go on',
      targetSceneId: 's-2',
      targetBookmarkId: 'scene-s2',
      targetSceneName: 'Next',
    });
  });

  it('carries choice requirements and effects onto the choice block', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [
        makeChoice({
          requirements: ['Requires all of:', '• Requires the Brass Key'],
          effects: ['Effects', '• Gain the Rusty Key'],
        }),
      ],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });

    expect(manuscript.blocks[5]).toMatchObject({
      kind: 'choice',
      requirements: ['Requires all of:', '• Requires the Brass Key'],
      effects: ['Effects', '• Gain the Rusty Key'],
    });
  });

  it('leaves requirements and effects absent on open choices', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [makeChoice()],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });

    const block = manuscript.blocks[5];
    expect(block.kind).toBe('choice');
    if (block.kind === 'choice') {
      expect(block.requirements).toBeUndefined();
      expect(block.effects).toBeUndefined();
    }
  });

  it('drops loose scenes, emptied containers and the heading when excluded', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
    });

    expect(kinds(manuscript.blocks)).toEqual([
      'title',
      'chapter',
      'scene-heading',
      'paragraph',
      'paragraph',
      'scene-heading',
      'paragraph',
    ]);
  });

  it('degrades choices whose target left the export to name-only', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [makeChoice({ sceneId: 's-2', nextSceneId: 's-loose' })],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
    });

    const choice = manuscript.blocks.find((block) => block.kind === 'choice');
    expect(choice).toMatchObject({
      targetSceneId: 's-loose',
      targetBookmarkId: null,
      targetSceneName: 'Note',
    });
  });

  it('omits scene headings and bare choices when scene names are off', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [makeChoice()],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
      includeSceneNames: false,
    });

    expect(kinds(manuscript.blocks)).toEqual([
      'title',
      'chapter',
      'paragraph',
      'paragraph',
      'choice',
      'paragraph',
      'loose-heading',
      'paragraph',
    ]);
    expect(manuscript.blocks.find((block) => block.kind === 'choice')).toMatchObject({
      text: 'Go on',
      targetBookmarkId: null,
      targetSceneName: null,
    });
  });
});

describe('withoutLooseSections', () => {
  it('drops containers left empty by the exclusion', () => {
    const chapters = [
      makeChapter(),
      makeChapter({ id: 'ev-1', name: 'Quake', index: 1, type: 'event' }),
    ];
    const scenes = [
      makeScene(),
      makeScene({ id: 's-ev', chapterId: 'ev-1', name: 'Tremor', body: 'Shake.' }),
    ];
    const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

    const kept = withoutLooseSections(linearManuscriptSections(chapters, scenes), chaptersById);

    expect(kept.map((section) => section.key)).toEqual(['container-ch-1', 'scene-s-1']);
  });
});

describe('compileLinearManuscript strikethrough', () => {
  it('maps ~~ spans and defaults the flag to false elsewhere', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter()],
      scenes: [makeScene({ body: 'A ~~cut~~ line.' })],
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
    });

    const paragraph = manuscript.blocks.find((block) => block.kind === 'paragraph');
    expect(paragraph).toMatchObject({
      kind: 'paragraph',
      spans: [
        { text: 'A ', strikethrough: false },
        { text: 'cut', strikethrough: true },
        { text: ' line.', strikethrough: false },
      ],
    });
  });
});

describe('compileRouteManuscript', () => {
  it('compiles steps with a route subtitle and repeat-safe bookmarks', () => {
    const scenes = [
      makeScene({ id: 's-a', name: 'Alpha', body: 'First.' }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    ];
    const manuscript = compileRouteManuscript({
      title: 'My Story',
      routeName: 'Main',
      steps: [
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
        makeStep({ id: 'step-2', position: 2, sceneId: 's-b' }),
        makeStep({ id: 'step-3', position: 3, sceneId: 's-a' }),
      ],
      scenes,
      choices: [makeChoice({ id: 'c-1', sceneId: 's-a', nextSceneId: 's-b' })],
      looseHeadingLabel: 'Loose',
    });

    expect(kinds(manuscript.blocks)).toEqual([
      'title',
      'subtitle',
      'scene-heading',
      'paragraph',
      'choice',
      'scene-heading',
      'paragraph',
      'scene-heading',
      'paragraph',
      'choice',
    ]);
    const headings = manuscript.blocks.filter((block) => block.kind === 'scene-heading');
    expect(
      headings.map((heading) => (heading as { bookmarkId: string | null }).bookmarkId),
    ).toEqual(['scene-sa', 'scene-sb', null]);
  });

  it('omits scene headings when scene names are off', () => {
    const scenes = [
      makeScene({ id: 's-a', name: 'Alpha', body: 'First.' }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    ];
    const manuscript = compileRouteManuscript({
      title: 'My Story',
      routeName: 'Main',
      steps: [
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
        makeStep({ id: 'step-2', position: 2, sceneId: 's-b' }),
      ],
      scenes,
      choices: [],
      looseHeadingLabel: 'Loose',
      includeSceneNames: false,
    });

    expect(kinds(manuscript.blocks)).toEqual(['title', 'subtitle', 'paragraph', 'paragraph']);
  });
});

describe('bookmarkIdForChapter', () => {
  it('builds Word-safe bookmark names that never collide with scenes', () => {
    expect(bookmarkIdForChapter('ch-1')).toBe('chapter-ch1');
    expect(bookmarkIdForChapter('a b.c-d')).toBe('chapter-abcd');
    expect(bookmarkIdForChapter('s-1')).not.toBe(bookmarkIdForScene('s-1'));
  });
});

describe('resetSceneNumbersPerChapter', () => {
  const chapters = [makeChapter(), makeChapter({ id: 'ch-2', name: 'Later', index: 2 })];
  const scenes = [
    makeScene({ id: 's-1', chapterId: 'ch-1', index: 1 }),
    makeScene({ id: 's-2', chapterId: 'ch-1', index: 2 }),
    makeScene({ id: 's-3', chapterId: 'ch-2', index: 1 }),
    makeScene({ id: 's-loose', chapterId: null, index: 1 }),
  ];

  function headingNumbers(reset: boolean): number[] {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Loose',
      resetSceneNumbersPerChapter: reset,
    });
    return manuscript.blocks
      .filter((block) => block.kind === 'scene-heading')
      .map((block) => (block as { number: number }).number);
  }

  it('numbers scenes globally by default', () => {
    expect(headingNumbers(false)).toEqual([1, 2, 3, 4]);
  });

  it('restarts scene numbers in every chapter and the appendix', () => {
    expect(headingNumbers(true)).toEqual([1, 2, 1, 1]);
  });

  it('is a no-op for routes, which have a single group', () => {
    const scenes = [
      makeScene({ id: 's-a', name: 'Alpha', body: 'First.' }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    ];
    const manuscript = compileRouteManuscript({
      title: 'My Story',
      routeName: 'Main',
      steps: [
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
        makeStep({ id: 'step-2', position: 2, sceneId: 's-b' }),
      ],
      scenes,
      choices: [],
      looseHeadingLabel: 'Loose',
      resetSceneNumbersPerChapter: true,
    });

    expect(
      manuscript.blocks
        .filter((block) => block.kind === 'scene-heading')
        .map((block) => (block as { number: number }).number),
    ).toEqual([1, 2]);
  });
});

describe('manuscriptTocEntries', () => {
  it('lists chapters, appendix and scenes in document order', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter(), makeChapter({ id: 'ch-2', name: 'Later', index: 2 })],
      scenes: [
        makeScene({ id: 's-1', chapterId: 'ch-1', index: 1 }),
        makeScene({ id: 's-2', chapterId: 'ch-2', index: 1 }),
        makeScene({ id: 's-loose', chapterId: null, index: 1 }),
      ],
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Appendix',
    });

    expect(manuscriptTocEntries(manuscript.blocks)).toEqual([
      { level: 0, text: '1. Arrival', bookmarkId: 'chapter-ch1' },
      { level: 1, text: '1. Opening', bookmarkId: 'scene-s1' },
      { level: 0, text: '2. Later', bookmarkId: 'chapter-ch2' },
      { level: 1, text: '2. Opening', bookmarkId: 'scene-s2' },
      { level: 0, text: 'Appendix', bookmarkId: 'appendix' },
      { level: 1, text: '3. Opening', bookmarkId: 'scene-sloose' },
    ]);
  });

  it("links repeat visits to the scene's first bookmark", () => {
    const manuscript = compileRouteManuscript({
      title: 'My Story',
      routeName: 'Main',
      steps: [
        makeStep({ id: 'step-1', position: 1, sceneId: 's-a' }),
        makeStep({ id: 'step-2', position: 2, sceneId: 's-a' }),
      ],
      scenes: [makeScene({ id: 's-a', name: 'Alpha', body: 'First.' })],
      choices: [],
      looseHeadingLabel: 'Loose',
    });

    expect(manuscriptTocEntries(manuscript.blocks)).toEqual([
      { level: 1, text: '1. Alpha', bookmarkId: 'scene-sa' },
      { level: 1, text: '2. Alpha', bookmarkId: 'scene-sa' },
    ]);
  });

  it('lists no scenes when scene names are off', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter()],
      scenes: [makeScene()],
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Appendix',
      includeSceneNames: false,
    });

    expect(manuscriptTocEntries(manuscript.blocks)).toEqual([
      { level: 0, text: '1. Arrival', bookmarkId: 'chapter-ch1' },
    ]);
  });
});
