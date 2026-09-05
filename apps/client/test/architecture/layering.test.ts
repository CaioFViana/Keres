/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * The client's layers, checked rather than agreed.
 *
 * The direction is only one: `db` → `services` → `hooks`/`state` → `screens`/`components`. Every rule
 * here already passes today - their value is not to point at debt, it is that the first violation fails a
 * test instead of becoming the normal way of doing things. The `importBoundaries` test takes care of the other
 * half: cycles and data fetching inside the drawing layer.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const sourceFiles = listSourceFiles(SOURCE_ROOT);
const relativeOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');

/** Every imported specifier, be it a type or a value: what matters here is the direction. */
const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const importsOf = (path: string) =>
  Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]);

/** O caminho, dentro de `src`, para onde um especificador aponta - ou `null` se sai do app. */
function areaOf(specifier: string, origin: string): string | null {
  if (specifier.startsWith('@/src/')) return specifier.slice('@/src/'.length);
  if (!specifier.startsWith('.')) return null;
  const resolved = resolve(join(SOURCE_ROOT, relativeOf(origin), '..'), specifier);
  const inside = relative(SOURCE_ROOT, resolved).replace(/\\/g, '/');
  return inside.startsWith('..') ? null : inside;
}

function filesUnder(area: string) {
  return sourceFiles.filter((path) => relativeOf(path).startsWith(`${area}/`));
}

function offendingImports(files: string[], forbidden: RegExp): string[] {
  return files
    .flatMap((path) =>
      importsOf(path)
        .map((specifier) => areaOf(specifier, path))
        .filter((target): target is string => target !== null && forbidden.test(target))
        .map((target) => `${relativeOf(path)} -> ${target}`),
    )
    .sort();
}

describe('client layers', () => {
  /**
   * A service that imports a screen ties business rules to a layout: from then on there is no way
   * to test the rule without mounting a component, nor to reuse it on another screen.
   */
  it('keeps services and database unaware that a UI exists', () => {
    expect(
      offendingImports(
        [...filesUnder('services'), ...filesUnder('db')],
        /^(components|screens|navigation)\//,
      ),
    ).toEqual([]);
  });

  /** The store holds state, it does not draw: whoever draws subscribes to the store, never the other way round. */
  it('keeps the stores unaware that a UI exists', () => {
    expect(offendingImports(filesUnder('state'), /^(components|screens|navigation)\//)).toEqual([]);
  });

  /**
   * A screen importing a screen is the shortest path to a cycle and to a duplicated
   * `ParamList`. What two screens share becomes a component, a hook or a service.
   */
  it('does not let one screen import another', () => {
    const offenders = filesUnder('screens')
      .flatMap((path) => {
        const home = relativeOf(path).split('/').slice(0, 2).join('/');
        return importsOf(path)
          .map((specifier) => areaOf(specifier, path))
          .filter(
            (target): target is string =>
              target !== null && target.startsWith('screens/') && !target.startsWith(`${home}/`),
          )
          .map((target) => `${relativeOf(path)} -> ${target}`);
      })
      .sort();

    expect(offenders).toEqual([]);
  });
});

/**
 * A per-file size ceiling.
 *
 * It is not aesthetics: past some six hundred lines, nobody reads the whole file before
 * editing any more, and that is when the same rule starts existing in two places. The list below is
 * today's debt and can only shrink - `toEqual` refuses both a new file blowing the ceiling
 * and a name that stays listed after having been broken up.
 */
const LINE_LIMIT = 600;
const FILES_OVER_THE_LIMIT = [
  'components/features/presence-matrix/PresenceMatrixViewerContent.tsx',
  'navigation/MainSystemStack.tsx',
  'screens/characters/CharacterDetailScreen.tsx',
  'screens/characters/CharacterFormScreen.tsx',
  'screens/enterstack/ServerRegistrationScreen.tsx',
  'screens/locations/LocationFormScreen.tsx',
  'screens/mainstorystack/StorySettingsScreen.tsx',
  'screens/narrative-elements/chapters/NarrativeElementsListScreen.tsx',
  'screens/narrative-elements/choices/ChoiceFormScreen.tsx',
  'screens/narrative-elements/choices/ChoiceViewScreen.tsx',
  'screens/narrative-elements/scenes/SceneDetailScreen.tsx',
  'screens/narrative-elements/scenes/SceneFormScreen.tsx',
  'utils/storyAnalysisChecks.ts',
];

/** Counts only meaningful source lines, leaving comments and visual spacing out of the ceiling. */
function codeLineCount(content: string): number {
  let inBlockComment = false;
  let inString: string | null = null;
  let lines = 0;

  for (const line of content.split(/\r?\n/)) {
    let hasCode = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const next = line[index + 1];
      if (inBlockComment) {
        if (character === '*' && next === '/') {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }
      if (inString) {
        hasCode = true;
        if (character === '\\') index += 1;
        else if (character === inString) inString = null;
        continue;
      }
      if (character === '/' && next === '/') break;
      if (character === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') {
        inString = character;
        hasCode = true;
        continue;
      }
      if (!/\s/.test(character)) hasCode = true;
    }
    if (hasCode) lines += 1;
  }
  return lines;
}

describe('file size', () => {
  it('disregards comments and blank lines when measuring source files', () => {
    expect(
      codeLineCount(
        ['', '// Documentation.', '/* More documentation.', ' */', '', 'const item = 1;'].join(
          '\n',
        ),
      ),
    ).toBe(1);
  });

  it('does not let a new file be born above the ceiling', () => {
    const oversized = sourceFiles
      .filter((path) => codeLineCount(readFileSync(path, 'utf8')) > LINE_LIMIT)
      .map(relativeOf)
      .sort();

    expect(oversized).toEqual([...FILES_OVER_THE_LIMIT].sort());
  });
});
