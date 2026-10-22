/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Nothing under `src/` writes to `console` directly: every diagnostic line goes through
 * `utils/logging/logger.ts`, so what is shown, where it goes and what a release build keeps quiet is
 * decided in one place. A direct `console.log` here fails the run instead of becoming a habit again.
 */

const SOURCE_ROOT = resolve(__dirname, '../../src');
const LOGGER = 'utils/logging/logger.ts';

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Source with block and line comments removed, so a sentence that mentions `console.error` is not a call. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('console usage in the client', () => {
  it('goes through the logger everywhere but the logger itself', () => {
    const offenders = listSourceFiles(SOURCE_ROOT)
      .map((path) => relative(SOURCE_ROOT, path).replace(/\\/g, '/'))
      .filter((path) => path !== LOGGER)
      .filter((path) =>
        /\bconsole\s*\./.test(withoutComments(readFileSync(join(SOURCE_ROOT, path), 'utf8'))),
      )
      .sort();

    expect(offenders).toEqual([]);
  });
});
