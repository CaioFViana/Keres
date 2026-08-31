/** @jest-environment node */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SCREEN_ROOT = resolve(__dirname, '../../src/screens');

const screenFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? screenFiles(path) : entry.endsWith('.tsx') ? [path] : [];
  });

/**
 * Navigation options live on the navigator, not on the screen instance. A header action therefore
 * survives when the next screen sets only its title. Every screen that writes header options must
 * say what happens to the right side explicitly: render an action or reset it.
 */
describe('header option ownership', () => {
  it('never leaves a previous screen header-right action behind', () => {
    const offenders = screenFiles(SCREEN_ROOT)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('setOptions(') && !source.includes('headerRight');
      })
      .map((path) => path.slice(SCREEN_ROOT.length + 1).replace(/\\/g, '/'))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('updates header options only while its screen is focused', () => {
    const offenders = screenFiles(SCREEN_ROOT)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return source.includes('setOptions(') && !source.includes('useFocusEffect(');
      })
      .map((path) => path.slice(SCREEN_ROOT.length + 1).replace(/\\/g, '/'))
      .sort();

    expect(offenders).toEqual([]);
  });
});
