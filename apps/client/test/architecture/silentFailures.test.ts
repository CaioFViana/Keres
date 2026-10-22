/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A failure that is swallowed leaves no trace: the screen shows something stale and nobody knows why.
 * A fallback for a failure that is expected (a value that does not parse, a path that is gone) is
 * fine, and so is a best-effort write to storage - but it says so: it logs at debug, or its body
 * holds a comment that explains why nothing is done. What is not allowed is the empty shrug.
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

function offenders(pattern: RegExp): string[] {
  return sourceFiles
    .flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return Array.from(text.matchAll(pattern), (match) => {
        const line = text.slice(0, match.index).split('\n').length;
        return `${relativeOf(path)}:${line}`;
      });
    })
    .sort();
}

describe('swallowed failures', () => {
  it('scans the source it is meant to guard', () => {
    expect(sourceFiles.length).toBeGreaterThan(500);
  });

  it('has no promise callback that catches and does nothing', () => {
    expect(offenders(/\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*\{\s*\}\s*\)/g)).toEqual([]);
  });

  it('has no catch block that is empty, comment aside', () => {
    expect(offenders(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)).toEqual([]);
  });
});
