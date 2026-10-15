import { compileStoryReader, readerScriptBundles } from '@keres/shared';
import type { CompileStoryReaderInput, ReaderOptionsInput } from '@keres/shared';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { READER_CSP, READER_SCRIPT_HASHES } from '@/modules/public/readerCsp';

const hashOf = (source: string) =>
  `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;

/** The executable engine block of a compiled reader page (not its JSON story data). */
function executableScriptOf(html: string): string {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('Expected a compiled reader page to carry an executable script.');
  return match[1];
}

const scene = (
  id: string,
  index: number,
  body: string | null,
  overrides: Record<string, unknown> = {},
) => ({ id, chapterId: null, name: id, index, body, isDeleted: false, ...overrides });

function linearInput(paged: boolean): CompileStoryReaderInput {
  return {
    storyTitle: 'Filed',
    storyType: 'linear',
    chapters: [],
    scenes: [
      paged
        ? scene('s1', 1, null, {
            pages: [{ id: 'p1', mediaId: null, text: 'A panel.', fit: 'contain' }],
          })
        : scene('s1', 1, 'Filed body.'),
    ],
    choices: [],
  };
}

function branchingInput(): CompileStoryReaderInput {
  return {
    storyTitle: 'The Key',
    storyType: 'branching',
    chapters: [],
    scenes: [scene('a', 1, 'You stand in the hall.'), scene('b', 2, 'Damp stone.')],
    choices: [{ id: 'c-on', sceneId: 'a', nextSceneId: 'b', text: 'Go on' }],
    rules: { groups: [], checks: [], effects: [], items: [] },
  };
}

describe('reader Content-Security-Policy', () => {
  it('names exactly the three served bundles, keeping inline as the legacy fallback', () => {
    const bundles = readerScriptBundles();
    const expected = [bundles.branching, bundles.linear, bundles.comic].map(hashOf);

    expect(READER_SCRIPT_HASHES).toEqual(expected);

    const scriptSrc = READER_CSP.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('script-src'))!;
    const sources = scriptSrc.replace('script-src', '').trim().split(/\s+/).sort();
    // A browser that understands hashes ignores `unsafe-inline` and runs only the three known
    // bundles; one without hash support still opens the reader through the fallback.
    expect(sources).toEqual([...expected, "'unsafe-inline'"].sort());
  });

  it('keeps the sandbox, the style fallback and the no-fetch rules', () => {
    expect(READER_CSP).toContain('sandbox allow-scripts');
    expect(READER_CSP).toContain("default-src 'none'");
    expect(READER_CSP).toContain("style-src 'unsafe-inline'");
    expect(READER_CSP).toContain('img-src data:');
    expect(READER_CSP).toContain("base-uri 'none'");
    expect(READER_CSP).toContain("form-action 'none'");
  });

  it.each([
    ['branching', branchingInput(), {}],
    ['linear', linearInput(false), {}],
    ['comic', linearInput(true), { pageLayout: 'sheet' }],
  ] as [string, CompileStoryReaderInput, ReaderOptionsInput][])(
    'serves a %s page whose engine hashes into the policy',
    (_kind, input, options) => {
      const { bytes } = compileStoryReader(input, options);
      const html = new TextDecoder().decode(bytes);

      expect(READER_SCRIPT_HASHES).toContain(hashOf(executableScriptOf(html)));
      // The in-page fallback for a header-less open stays as it was.
      expect(html).toContain("script-src 'unsafe-inline'");
    },
  );

  it('ships engine code with no inline handlers, javascript: links, eval or string timers', () => {
    const sources = Object.values(readerScriptBundles());
    expect(sources).toHaveLength(3);

    for (const source of sources) {
      // A handler becomes code only as a DOM property (`node.onclick = ...`) or inline markup
      // (`<button onclick=...>`); a plain variable that happens to start with "on" is harmless.
      expect(source).not.toMatch(/\.\s*on\w+\s*=/);
      expect(source).not.toMatch(/<\w+[^>]*\son\w+\s*=/);
      expect(source).not.toContain('javascript:');
      expect(source).not.toMatch(/\beval\s*\(/);
      expect(source).not.toContain('new Function');
      // A numeric delay is a timer; a string delay is code.
      expect(source).not.toMatch(/setTimeout\s*\(\s*['"`]/);
      expect(source).not.toMatch(/setInterval\s*\(\s*['"`]/);
    }
  });
});
