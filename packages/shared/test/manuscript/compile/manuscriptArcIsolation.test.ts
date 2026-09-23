import { describe, expect, it } from 'vitest';
import { compileStoryManuscript } from '../../../manuscript/compile/compileStoryManuscript';
import {
  compileLinearManuscript,
  type CompiledBlock,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  chapterMatchesArc,
  linearManuscriptSections,
  sceneMatchesArc,
  type ManuscriptChapter,
  type ManuscriptScene,
  type ManuscriptSection,
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

function sectionIds(sections: ManuscriptSection[]): string[] {
  return sections.map((section) =>
    section.kind === 'scene'
      ? `scene:${section.scene.id}`
      : section.kind === 'container'
        ? `container:${section.containerId}`
        : 'loose-heading',
  );
}

function textOf(blocks: CompiledBlock[]): string {
  return JSON.stringify(blocks);
}

describe('chapterMatchesArc / sceneMatchesArc', () => {
  const chaptersById = new Map([
    ['ch-1', { arcId: 'arc-1' }],
    ['ch-2', { arcId: 'arc-2' }],
    ['ch-legacy', { arcId: null }],
  ]);

  it('matches everything without an arc', () => {
    expect(chapterMatchesArc({ arcId: 'arc-1' }, null)).toBe(true);
    expect(chapterMatchesArc({ arcId: 'arc-1' }, undefined)).toBe(true);
    expect(sceneMatchesArc({ chapterId: 'ch-1' }, chaptersById, null)).toBe(true);
    expect(sceneMatchesArc({ chapterId: 'ch-1' }, chaptersById, undefined)).toBe(true);
  });

  it('matches only the arc containers', () => {
    expect(chapterMatchesArc({ arcId: 'arc-1' }, 'arc-1')).toBe(true);
    expect(chapterMatchesArc({ arcId: 'arc-2' }, 'arc-1')).toBe(false);
    expect(chapterMatchesArc({ arcId: null }, 'arc-1')).toBe(false);
    expect(chapterMatchesArc({}, 'arc-1')).toBe(false);
  });

  it('lets scenes inherit their container arc, keeping the containerless visible', () => {
    expect(sceneMatchesArc({ chapterId: 'ch-1' }, chaptersById, 'arc-1')).toBe(true);
    expect(sceneMatchesArc({ chapterId: 'ch-2' }, chaptersById, 'arc-1')).toBe(false);
    expect(sceneMatchesArc({ chapterId: null }, chaptersById, 'arc-1')).toBe(true);
    expect(sceneMatchesArc({ chapterId: 'gone' }, chaptersById, 'arc-1')).toBe(true);
  });
});

describe('linearManuscriptSections with arcId', () => {
  const chapters = [
    makeChapter({ id: 'ch-1', name: 'One', index: 1, arcId: 'arc-1' }),
    makeChapter({ id: 'ch-2', name: 'Two', index: 2, arcId: 'arc-2' }),
    makeChapter({ id: 'ev-1', name: 'Quake', index: 1, type: 'event', arcId: 'arc-2' }),
  ];
  const scenes = [
    makeScene({ id: 's-1', chapterId: 'ch-1', name: 'A1' }),
    makeScene({ id: 's-2', chapterId: 'ch-2', index: 1, name: 'B1' }),
    makeScene({ id: 's-ev', chapterId: 'ev-1', index: 1, name: 'Tremor' }),
    makeScene({ id: 's-loose', chapterId: null, index: 9, name: 'Fragment' }),
    makeScene({ id: 's-orphan', chapterId: 'gone', index: 10, name: 'Orphan' }),
  ];

  it('shows every arc without an arcId', () => {
    expect(sectionIds(linearManuscriptSections(chapters, scenes))).toEqual([
      'container:ch-1',
      'scene:s-1',
      'container:ch-2',
      'scene:s-2',
      'container:ev-1',
      'scene:s-ev',
      'loose-heading',
      'scene:s-loose',
      'scene:s-orphan',
    ]);
    expect(sectionIds(linearManuscriptSections(chapters, scenes, { arcId: null }))).toEqual(
      sectionIds(linearManuscriptSections(chapters, scenes)),
    );
  });

  it('keeps only the arc containers and scenes, hiding the rest with their scenes', () => {
    const sections = linearManuscriptSections(chapters, scenes, { arcId: 'arc-1' });

    expect(sectionIds(sections)).toEqual([
      'container:ch-1',
      'scene:s-1',
      'loose-heading',
      'scene:s-loose',
      'scene:s-orphan',
    ]);
    // Positions restart over the visible scenes: no gaps leak the hidden count.
    expect(
      sections.filter((s) => s.kind === 'scene').map((s) => (s as { position: number }).position),
    ).toEqual([1, 2, 3]);
  });

  it('keeps event containers of the arc after its chapters', () => {
    expect(sectionIds(linearManuscriptSections(chapters, scenes, { arcId: 'arc-2' }))).toEqual([
      'container:ch-2',
      'scene:s-2',
      'container:ev-1',
      'scene:s-ev',
      'loose-heading',
      'scene:s-loose',
      'scene:s-orphan',
    ]);
  });

  it('shows only the homeless tail when the arc owns no container', () => {
    expect(sectionIds(linearManuscriptSections(chapters, scenes, { arcId: 'arc-empty' }))).toEqual([
      'loose-heading',
      'scene:s-loose',
      'scene:s-orphan',
    ]);
  });
});

describe('compileLinearManuscript with arcId', () => {
  const chapters = [
    makeChapter({ id: 'ch-1', name: 'One', index: 1, arcId: 'arc-1' }),
    makeChapter({ id: 'ch-2', name: 'Two', index: 2, arcId: 'arc-2' }),
  ];
  const scenes = [
    makeScene({ id: 's-1', chapterId: 'ch-1', name: 'A1', body: 'Alpha.' }),
    makeScene({ id: 's-2', chapterId: 'ch-2', index: 1, name: 'B1', body: 'Beta.' }),
  ];

  it('defaults to all arcs', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters,
      scenes,
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
    });
    const text = textOf(manuscript.blocks);
    expect(text).toContain('Alpha.');
    expect(text).toContain('Beta.');
  });

  it('excludes the other arc chapters and scenes', () => {
    const manuscript = compileLinearManuscript({
      title: 'Arc One',
      chapters,
      scenes,
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
      arcId: 'arc-1',
    });
    const text = textOf(manuscript.blocks);
    expect(manuscript.title).toBe('Arc One');
    expect(text).toContain('Alpha.');
    expect(text).not.toContain('Beta.');
    expect(text).not.toContain('"name":"Two"');
  });

  it('renumbers single-arc chapters from 1 in emission order', () => {
    const arcChapters = [
      makeChapter({ id: 'ch-2', name: 'Two', index: 2, arcId: 'arc-2' }),
      makeChapter({ id: 'ch-3', name: 'Three', index: 5, arcId: 'arc-2' }),
    ];
    const arcScenes = [
      makeScene({ id: 's-2', chapterId: 'ch-2', name: 'B1', body: 'Beta.' }),
      makeScene({ id: 's-3a', chapterId: 'ch-3', index: 1, name: 'C1', body: 'Gamma.' }),
      makeScene({ id: 's-3b', chapterId: 'ch-3', index: 2, name: 'C2', body: 'Delta.' }),
    ];
    const manuscript = compileLinearManuscript({
      title: 'Arc Two',
      chapters: arcChapters,
      scenes: arcScenes,
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
      arcId: 'arc-2',
    });

    expect(
      manuscript.blocks.flatMap((block) => (block.kind === 'chapter' ? [block.number] : [])),
    ).toEqual([1, 2]);
    // Scenes follow: positions already restart over the visible scenes.
    expect(
      manuscript.blocks.flatMap((block) => (block.kind === 'scene-heading' ? [block.number] : [])),
    ).toEqual([1, 2, 3]);
  });

  it('renumbers single-arc chapters with per-chapter scene restart', () => {
    const manuscript = compileLinearManuscript({
      title: 'Arc Two',
      chapters: [makeChapter({ id: 'ch-2', name: 'Two', index: 2, arcId: 'arc-2' })],
      scenes: [
        makeScene({ id: 's-2a', chapterId: 'ch-2', index: 7, name: 'B1', body: 'Beta.' }),
        makeScene({ id: 's-2b', chapterId: 'ch-2', index: 8, name: 'B2', body: 'Beta two.' }),
      ],
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
      arcId: 'arc-2',
      resetSceneNumbersPerChapter: true,
    });

    expect(
      manuscript.blocks.flatMap((block) => (block.kind === 'chapter' ? [block.number] : [])),
    ).toEqual([1]);
    expect(
      manuscript.blocks.flatMap((block) => (block.kind === 'scene-heading' ? [block.number] : [])),
    ).toEqual([1, 2]);
  });

  it('keeps story-wide chapter numbers when exporting all arcs', () => {
    const manuscript = compileLinearManuscript({
      title: 'My Story',
      chapters: [
        makeChapter({ id: 'ch-2', name: 'Two', index: 2, arcId: 'arc-2' }),
        makeChapter({ id: 'ch-3', name: 'Three', index: 5, arcId: 'arc-2' }),
      ],
      scenes: [
        makeScene({ id: 's-2', chapterId: 'ch-2', name: 'B1', body: 'Beta.' }),
        makeScene({ id: 's-3', chapterId: 'ch-3', index: 1, name: 'C1', body: 'Gamma.' }),
      ],
      choices: [],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
    });

    expect(
      manuscript.blocks.flatMap((block) => (block.kind === 'chapter' ? [block.number] : [])),
    ).toEqual([2, 5]);
  });

  it('keeps choices of visible scenes, with hidden targets as name-only references', () => {
    const manuscript = compileLinearManuscript({
      title: 'Arc One',
      chapters,
      scenes,
      choices: [{ id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Cross over' }],
      includeLooseScenes: false,
      looseHeadingLabel: 'Loose',
      arcId: 'arc-1',
    });
    // Same as a choice into excluded loose scenes: the reference stays, the link drops.
    expect(manuscript.blocks).toContainEqual({
      kind: 'choice',
      id: 'choice-1',
      text: 'Cross over',
      targetSceneId: 's-2',
      targetBookmarkId: null,
      targetSceneName: 'B1',
    });
  });
});

describe('compileStoryManuscript with arcId', () => {
  const chapters: ManuscriptChapter[] = [
    { id: 'ch-1', name: 'One', index: 1, type: 'chapter', arcId: 'arc-1' },
    { id: 'ch-2', name: 'Two', index: 2, type: 'chapter', arcId: 'arc-2' },
  ];
  const scenes: ManuscriptScene[] = [
    { id: 's-1', chapterId: 'ch-1', name: 'A1', index: 1, body: 'Alpha.', isDeleted: false },
    { id: 's-2', chapterId: 'ch-2', name: 'B1', index: 1, body: 'Beta.', isDeleted: false },
  ];

  it('filters the linear order to the arc', async () => {
    const compiled = await compileStoryManuscript(
      { storyTitle: 'My Story', storyType: 'linear', chapters, scenes, choices: [] },
      { format: 'md', arcId: 'arc-1' },
    );
    const text = new TextDecoder().decode(compiled.bytes);
    expect(text).toContain('Alpha.');
    expect(text).not.toContain('Beta.');
  });

  it('drops route steps whose scenes belong to another arc', async () => {
    const compiled = await compileStoryManuscript(
      {
        storyTitle: 'My Story',
        storyType: 'branching',
        chapters,
        scenes,
        choices: [],
        routes: [{ id: 'route-1', name: 'Main' }],
        routeSteps: [
          { id: 'step-1', routeId: 'route-1', position: 1, sceneId: 's-1', isDeleted: false },
          { id: 'step-2', routeId: 'route-1', position: 2, sceneId: 's-2', isDeleted: false },
        ],
      },
      { format: 'md', routeId: 'route-1', arcId: 'arc-1' },
    );
    const text = new TextDecoder().decode(compiled.bytes);
    expect(text).toContain('Alpha.');
    expect(text).not.toContain('Beta.');
  });
});
