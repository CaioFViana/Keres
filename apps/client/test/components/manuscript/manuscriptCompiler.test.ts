import type { ChapterSelect, ChoiceSelect, SceneSelect } from '../../../src/db/schema';
import {
  bookmarkIdForScene,
  compileLinearManuscript,
  compileRouteManuscript,
  withoutLooseSections,
  type CompiledBlock,
} from '../../../src/components/features/manuscript/export/manuscriptCompiler';
import { linearManuscriptSections } from '../../../src/components/features/manuscript/manuscriptSections';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeChapter(overrides: Partial<ChapterSelect> = {}): ChapterSelect {
  return {
    id: 'ch-1',
    storyId: 'story-1',
    name: 'Arrival',
    index: 1,
    type: 'chapter',
    summary: null,
    isFavorite: false,
    extraNotes: null,
    arcId: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeScene(overrides: Partial<SceneSelect> = {}): SceneSelect {
  return {
    id: 's-1',
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: 'Opening',
    index: 1,
    summary: null,
    body: 'First line.\n\nSecond **bold** line.',
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeChoice(overrides: Partial<ChoiceSelect> = {}): ChoiceSelect {
  return {
    id: 'choice-1',
    storyId: 'story-1',
    sceneId: 's-1',
    nextSceneId: 's-2',
    text: 'Go on',
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  } as ChoiceSelect;
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
      spans: [{ text: 'Second ', bold: false, italic: false }, { text: 'bold', bold: true, italic: false }, { text: ' line.', bold: false, italic: false }],
    });
    expect(manuscript.blocks[5]).toMatchObject({
      kind: 'choice',
      text: 'Go on',
      targetSceneId: 's-2',
      targetBookmarkId: 'scene-s2',
      targetSceneName: 'Next',
    });
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
        { id: 'step-1', position: 1, sceneId: 's-a', isDeleted: false },
        { id: 'step-2', position: 2, sceneId: 's-b', isDeleted: false },
        { id: 'step-3', position: 3, sceneId: 's-a', isDeleted: false },
      ] as never,
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
    expect(headings.map((heading) => (heading as { bookmarkId: string | null }).bookmarkId)).toEqual([
      'scene-sa',
      'scene-sb',
      null,
    ]);
  });
});
