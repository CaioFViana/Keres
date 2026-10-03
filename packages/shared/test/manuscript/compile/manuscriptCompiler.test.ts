import { describe, expect, it } from 'vitest';
import {
  bookmarkIdForChapter,
  bookmarkIdForScene,
  compileLinearManuscript,
  compileGamebookManuscript,
  manuscriptTocEntries,
  withoutLooseSections,
  type CompiledBlock,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  linearManuscriptSections,
  type ManuscriptChapter,
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

describe('compileGamebookManuscript', () => {
  const scenes = [
    makeScene({ id: 's-a', name: 'Alpha', body: 'First.', isStart: true }),
    makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    makeScene({ id: 's-c', name: 'Gamma', index: 3, body: 'Third.' }),
    makeScene({ id: 's-lost', name: 'Lost', index: 4, body: 'Nobody comes here.' }),
  ];
  const choices = [
    makeChoice({ id: 'c-1', sceneId: 's-a', nextSceneId: 's-c', text: 'Left' }),
    makeChoice({ id: 'c-2', sceneId: 's-a', nextSceneId: 's-b', text: 'Right' }),
    makeChoice({ id: 'c-3', sceneId: 's-b', nextSceneId: 's-a', text: 'Back' }),
  ];
  const compile = (overrides: Record<string, unknown> = {}) =>
    compileGamebookManuscript({
      title: 'My Book',
      scenes,
      choices,
      order: 'discovery',
      showSceneNames: true,
      endLabel: 'the end of this excerpt',
      startLabels: { choose: 'Choose where to begin', begin: 'Begin' },
      ...overrides,
    });
  const headings = (manuscript: ReturnType<typeof compile>) =>
    manuscript.blocks
      .filter((block) => block.kind === 'scene-heading')
      .map((block) => block as Extract<CompiledBlock, { kind: 'scene-heading' }>);

  it('numbers the reachable scenes as they are met, the unreachable after them', () => {
    const manuscript = compile();

    expect(kinds(manuscript.blocks)[0]).toBe('title');
    expect(headings(manuscript).map((h) => `${h.number}. ${h.name}`)).toEqual([
      '1. Alpha',
      '2. Gamma',
      '3. Beta',
      '4. Lost',
    ]);
    expect(JSON.stringify(manuscript)).toContain('Nobody comes here.');
  });

  it('points each choice at its target, loops included', () => {
    const choiceBlocks = compile().blocks.filter((block) => block.kind === 'choice') as Extract<
      CompiledBlock,
      { kind: 'choice' }
    >[];

    expect(choiceBlocks.map((c) => [c.text, c.targetBookmarkId, c.targetSceneName])).toEqual([
      ['Left', 'scene-sc', 'Gamma'],
      ['Right', 'scene-sb', 'Beta'],
      ['Back', 'scene-sa', 'Alpha'],
    ]);
  });

  it('shows only numbers when names are off, and refers to scenes by number', () => {
    const manuscript = compile({ showSceneNames: false });

    expect(headings(manuscript).map((h) => h.name)).toEqual(['', '', '', '']);
    expect(headings(manuscript).map((h) => h.number)).toEqual([1, 2, 3, 4]);
    const targets = manuscript.blocks
      .filter((block) => block.kind === 'choice')
      .map((block) => (block as { targetSceneName: string | null }).targetSceneName);
    expect(targets).toEqual(['2', '3', '1']);
    expect(manuscriptTocEntries(manuscript.blocks).map((entry) => entry.text)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('scatters the scenes with a seed, the start staying number 1', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      makeScene({ id: `n-${index}`, name: `N${index}`, index, isStart: index === 0 }),
    );
    const chain = many
      .slice(1)
      .map((scene, index) =>
        makeChoice({ id: `k-${index}`, sceneId: many[index].id, nextSceneId: scene.id }),
      );
    const shuffled = (seed: string) =>
      headings(compile({ scenes: many, choices: chain, order: 'shuffled', seed })).map((h) => h.id);

    expect(shuffled('one')[0]).toBe('n-0');
    expect(shuffled('one')).toEqual(shuffled('one'));
    expect(shuffled('one')).not.toEqual(shuffled('two'));
    expect(shuffled('one')).not.toEqual(many.map((scene) => scene.id));
    expect([...shuffled('one')].sort()).toEqual(many.map((scene) => scene.id).sort());
  });

  it('ends a choice into a scene outside the export, saying so', () => {
    const manuscript = compile({
      scenes: scenes.filter((scene) => scene.id !== 's-c'),
    });
    const left = manuscript.blocks.find(
      (block) => block.kind === 'choice' && block.id === 'c-1',
    ) as Extract<CompiledBlock, { kind: 'choice' }>;

    expect(left).toMatchObject({
      text: 'Left — the end of this excerpt',
      targetBookmarkId: null,
      targetSceneName: null,
    });
  });

  describe('with several starts', () => {
    const twoStarts = [
      makeScene({ id: 's-a', name: 'Alpha', index: 1, body: 'First.', isStart: true }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.', isStart: true }),
      makeScene({ id: 's-c', name: 'Gamma', index: 3, body: 'Third.' }),
      makeScene({ id: 's-lost', name: 'Lost', index: 4, body: 'Nobody.' }),
    ];
    const links = [makeChoice({ id: 'c-1', sceneId: 's-b', nextSceneId: 's-c', text: 'On' })];

    it('opens on a page offering each start, and reaches from all of them', () => {
      const manuscript = compile({ scenes: twoStarts, choices: links });

      expect(kinds(manuscript.blocks).slice(0, 4)).toEqual([
        'title',
        'paragraph',
        'choice',
        'choice',
      ]);
      expect(manuscript.blocks[1]).toMatchObject({
        spans: [{ text: 'Choose where to begin', bold: true }],
      });
      const offered = manuscript.blocks.slice(2, 4) as Extract<CompiledBlock, { kind: 'choice' }>[];
      expect(offered.map((c) => [c.text, c.targetBookmarkId, c.targetSceneName])).toEqual([
        ['Begin', 'scene-sa', 'Alpha'],
        ['Begin', 'scene-sb', 'Beta'],
      ]);
      expect(headings(manuscript).map((h) => h.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Lost']);
    });

    it('offers numbers when names are off', () => {
      const offered = compile({ scenes: twoStarts, choices: links, showSceneNames: false })
        .blocks.slice(2, 4)
        .map((block) => (block as { targetSceneName: string | null }).targetSceneName);
      expect(offered).toEqual(['1', '2']);
    });

    it('adds no opening page for a single start', () => {
      expect(kinds(compile().blocks).slice(0, 2)).toEqual(['title', 'scene-heading']);
    });

    it('offers only the starts that made it into the export', () => {
      const manuscript = compile({
        scenes: twoStarts.filter((scene) => scene.id !== 's-b'),
        choices: links,
      });
      expect(kinds(manuscript.blocks).slice(0, 2)).toEqual(['title', 'scene-heading']);
    });
  });

  it('is empty of scenes when the story has none', () => {
    expect(kinds(compile({ scenes: [], choices: [] }).blocks)).toEqual(['title']);
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

describe('compileLinearManuscript lists', () => {
  it('compiles body items to bullet and ordered blocks in order', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters: [makeChapter()],
      scenes: [makeScene({ body: 'Intro.\n\n- one\n\n9. nine' })],
      choices: [],
      includeLooseScenes: true,
      looseHeadingLabel: 'Appendix',
    });

    expect(kinds(manuscript.blocks)).toEqual([
      'title',
      'chapter',
      'scene-heading',
      'paragraph',
      'bullet',
      'ordered',
    ]);
    expect(manuscript.blocks[4]).toMatchObject({ kind: 'bullet' });
    expect(manuscript.blocks[5]).toMatchObject({ kind: 'ordered', index: 9 });
  });
});
