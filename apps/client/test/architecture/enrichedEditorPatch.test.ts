/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const libraryDir = dirname(require.resolve('react-native-enriched-html/package.json'));
const read = (file: string) => readFileSync(join(libraryDir, file), 'utf8');

/**
 * The web editor's host can hand a component an editor that has already been destroyed: the hook
 * destroys one nobody mounted within a tick, and a commit that comes later (a lazy chunk, a heavy screen
 * such as a screenplay scene) finds it gone. The library's effects then called a command on it and threw
 * `Cannot read properties of null (reading 'commands')`, taking the screen down. `patches/` holds the guard;
 * this fails when a reinstall or an upgrade drops it.
 */
describe('the patch of react-native-enriched-html', () => {
  it('keeps the web effects from touching a destroyed editor', () => {
    expect(read('lib/module/web/EnrichedTextInput.js')).toMatch(
      /if \(!editor \|\| editor\.isDestroyed\) return;\s+editor\.commands\.normalizeBoldInStyledHeadings\(\)/,
    );
    expect(read('lib/module/web/useOnEditorChange.js')).toMatch(
      /if \(!handler \|\| editor\.isDestroyed\) return;/,
    );
  });
});
