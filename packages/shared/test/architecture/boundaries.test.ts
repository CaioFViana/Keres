import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What `@keres/shared` is allowed to know.
 *
 * It is imported by the client, the API, the admin panel and the site - anything it knows about one
 * of those becomes a dependency of the other four. Both rules here pass today; they are written so
 * the first violation fails in a test rather than becoming a habit.
 */

const ROOT = resolve(__dirname, '../..');
const SKIP = new Set(['node_modules', 'test', 'dist', 'coverage']);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (SKIP.has(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const sourceFiles = listSourceFiles(ROOT);
const relativeOf = (path: string) => relative(ROOT, path).split('\\').join('/');

function importsOf(path: string): string[] {
  return Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]);
}

function offenders(forbidden: RegExp, files = sourceFiles): string[] {
  return files
    .flatMap((path) =>
      importsOf(path)
        .filter((specifier) => forbidden.test(specifier))
        .map((specifier) => `${relativeOf(path)} -> ${specifier}`),
    )
    .sort();
}

describe('shared package boundaries', () => {
  /**
   * An upward dependency: the shared package knowing about an app stops it from being shared - and
   * drags the whole client into the API's build along with it.
   */
  it('imports from no app', () => {
    expect(offenders(/(^|\/)apps\//)).toEqual([]);
  });

  /**
   * `graphs/` computes positions and returns SVG as text. That is what lets the same modules draw on
   * the app's screen, in the image export and in a Node script. A React or React Native import in
   * there would tie all of that to a component tree.
   */
  it('keeps the graph modules free of React and React Native', () => {
    const graphFiles = sourceFiles.filter((path) => relativeOf(path).startsWith('graphs/'));

    expect(graphFiles.length).toBeGreaterThan(10);
    expect(
      offenders(/^(react|react-native|react-native-.*|expo|expo-.*|@expo\/.*)$/, graphFiles),
    ).toEqual([]);
  });
});
