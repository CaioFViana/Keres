/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SOURCE_ROOT = resolve(__dirname, '../../src');

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const relativeOf = (path: string) => relative(SOURCE_ROOT, path).replace(/\\/g, '/');

/** Files that are allowed to name another stack: the helper itself and the places that build the navigators. */
const MAY_NAME_A_STACK = (path: string) =>
  path === 'utils/stackNavigation.ts' || path.startsWith('navigation/');

/**
 * `navigate('SomeStack', { screen })` from a screen of another stack is the classic back-button bug: that
 * stack keeps its own history while the drawer shows another one, so the screen is pushed on top of
 * whatever it last showed, and the first tap on back reveals *that* - the person gets to where they came
 * from on the second or third. `navigateAcrossStacks` (or `useNavigateAcrossStacks`) registers the way
 * back; a return trip written as `onReturn` is the one place a raw navigate to a stack is right.
 */
describe('navigation between stacks', () => {
  it('leaves for another stack through the helper that registers the way back', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SOURCE_ROOT)) {
      const path = relativeOf(file);
      if (MAY_NAME_A_STACK(path)) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\.navigate\(\s*['"][A-Za-z]+Stack['"]/g)) {
        const before = source.slice(Math.max(0, (match.index ?? 0) - 240), match.index);
        if (/onReturn/.test(before)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${path}:${line}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
