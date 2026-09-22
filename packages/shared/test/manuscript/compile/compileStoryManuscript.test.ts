import JSZip from 'jszip';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  compileStoryManuscript,
  type CompileStoryManuscriptInput,
  type ManuscriptRoute,
} from '../../../manuscript/compile/compileStoryManuscript';
import type { ManuscriptChoice } from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  MAX_MANUSCRIPT_BYTES,
} from '../../../manuscript/compile/manuscriptContracts';
import type {
  ManuscriptChapter,
  ManuscriptRouteStep,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';
import type { ChapterRowType } from '../../../schemas/ChapterSchemas';
import type { ChoiceType } from '../../../schemas/ChoiceSchemas';
import type { RouteStepType, RouteType } from '../../../schemas/RouteSchemas';
import type { SceneType } from '../../../schemas/SceneSchemas';

describe('structural inputs', () => {
  it('accepts FullStoryExport collections as well as minimal rows', () => {
    // Compile-time: the API passes parsed export rows straight in.
    expectTypeOf<ChapterRowType>().toMatchTypeOf<ManuscriptChapter>();
    expectTypeOf<SceneType>().toMatchTypeOf<ManuscriptScene>();
    expectTypeOf<ChoiceType>().toMatchTypeOf<ManuscriptChoice>();
    expectTypeOf<RouteType>().toMatchTypeOf<ManuscriptRoute>();
    expectTypeOf<RouteStepType>().toMatchTypeOf<ManuscriptRouteStep>();
  });
});

function input(overrides: Partial<CompileStoryManuscriptInput> = {}): CompileStoryManuscriptInput {
  const chapters: ManuscriptChapter[] = [
    { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter' },
  ];
  const scenes: ManuscriptScene[] = [
    {
      id: 's-1',
      chapterId: 'ch-1',
      name: 'Opening',
      index: 1,
      body: 'First **bold** line.',
      isDeleted: false,
    },
    {
      id: 's-2',
      chapterId: 'ch-1',
      name: 'Next',
      index: 2,
      body: 'After.',
      isDeleted: false,
    },
    {
      id: 's-loose',
      chapterId: null,
      name: 'Note',
      index: 3,
      body: 'Aside.',
      isDeleted: false,
    },
  ];
  const choices: ManuscriptChoice[] = [
    { id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Go on' },
  ];
  return { storyTitle: 'My Story', storyType: 'linear', chapters, scenes, choices, ...overrides };
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('compileStoryManuscript formats', () => {
  it('renders markdown with its delivery metadata', async () => {
    const result = await compileStoryManuscript(input(), { format: 'md' });

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.extension).toBe('md');
    expect(result.mimeType).toBe('text/markdown');
    const md = textOf(result.bytes);
    expect(md).toContain('# My Story');
    expect(md).toContain('## 1. Arrival');
    expect(md).toContain('First **bold** line.');
    expect(md).toContain(`- Go on — ${DEFAULT_MANUSCRIPT_LABELS.goToScene} Next`);
  });

  it('renders plain text', async () => {
    const result = await compileStoryManuscript(input(), { format: 'txt' });

    expect(result.extension).toBe('txt');
    expect(result.mimeType).toBe('text/plain');
    const text = textOf(result.bytes);
    expect(text).toContain('My Story\n========');
    expect(text).toContain('First bold line.');
    expect(text).not.toContain('**');
  });

  it('renders standalone html', async () => {
    const result = await compileStoryManuscript(input(), { format: 'html' });

    expect(result.extension).toBe('html');
    expect(result.mimeType).toBe('text/html');
    const html = textOf(result.bytes);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1 class="title">My Story</h1>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders a docx zip carrying the manuscript', async () => {
    const result = await compileStoryManuscript(input(), { format: 'docx' });

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.extension).toBe('docx');
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const zip = await JSZip.loadAsync(result.bytes);
    const xml = await zip.file('word/document.xml')?.async('string');
    expect(xml).toContain('My Story');
    expect(xml).toContain('Opening');
  });
});

describe('compileStoryManuscript routes', () => {
  const routes: ManuscriptRoute[] = [
    { id: 'route-1', name: 'Main' },
    { id: 'route-2', name: 'Other' },
  ];
  const routeSteps: ManuscriptRouteStep[] = [
    { id: 'step-1', routeId: 'route-1', position: 1, sceneId: 's-2', isDeleted: false },
    { id: 'step-2', routeId: 'route-1', position: 2, sceneId: 's-1', isDeleted: false },
    { id: 'step-9', routeId: 'route-2', position: 1, sceneId: 's-loose', isDeleted: false },
  ];

  it('follows the selected route and ignores other routes steps', async () => {
    const result = await compileStoryManuscript(
      input({ storyType: 'branching', routes, routeSteps }),
      { format: 'md', routeId: 'route-1' },
    );

    const md = textOf(result.bytes);
    expect(md).toContain('*Main*');
    // Route order (s-2 first), and the other route's scene stays out.
    expect(md.indexOf('### 1. Next')).toBeLessThan(md.indexOf('### 2. Opening'));
    expect(md).not.toContain('Note');
  });

  it('throws on an unknown route', async () => {
    await expect(
      compileStoryManuscript(input({ storyType: 'branching', routes, routeSteps }), {
        format: 'md',
        routeId: 'gone',
      }),
    ).rejects.toThrow('Unknown route "gone".');
  });
});

describe('compileStoryManuscript loose scenes and labels', () => {
  it('includes loose scenes by default and drops them on request', async () => {
    const included = textOf((await compileStoryManuscript(input(), { format: 'md' })).bytes);
    expect(included).toContain(`## ${DEFAULT_MANUSCRIPT_LABELS.looseHeading}`);
    expect(included).toContain('Aside.');

    const excluded = textOf(
      (await compileStoryManuscript(input(), { format: 'md', includeLooseScenes: false })).bytes,
    );
    expect(excluded).not.toContain('Aside.');
  });

  it('merges partial label overrides over the defaults', async () => {
    const md = textOf(
      (
        await compileStoryManuscript(input(), {
          format: 'md',
          labels: { goToScene: 'Ver', looseHeading: 'Avulsas' },
        })
      ).bytes,
    );

    expect(md).toContain('- Go on — Ver Next');
    expect(md).toContain('## Avulsas');
  });
});

describe('compileStoryManuscript limits', () => {
  it('rejects an unknown format', async () => {
    await expect(compileStoryManuscript(input(), { format: 'pdf' as never })).rejects.toThrow();
  });

  it('throws past the byte budget', async () => {
    const big = input({
      scenes: [
        {
          id: 's-1',
          chapterId: 'ch-1',
          name: 'Opening',
          index: 1,
          body: 'x'.repeat(MAX_MANUSCRIPT_BYTES + 1),
          isDeleted: false,
        },
      ],
    });

    await expect(compileStoryManuscript(big, { format: 'txt' })).rejects.toThrow(
      `exceeds the ${MAX_MANUSCRIPT_BYTES}-byte limit`,
    );
  });
});
