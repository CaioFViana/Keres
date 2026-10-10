/** @jest-environment node */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../../src');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === 'generated' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

const relative = (path: string) => path.slice(SRC.length + 1).replace(/\\/g, '/');

/**
 * Styles that depend on the theme are built by a module-level factory and read through `useThemedStyles`, so
 * they are made once per palette. A `StyleSheet.create` inside a function body is rebuilt on every render.
 *
 * These four read too many values for the hook's `deps` (four or five sizes and insets): they build their
 * styles in the body and are listed so that this stays a decision, not a habit. Do not add to it: move the
 * styles to a factory, or fold the values into fewer.
 */
const BUILT_IN_THE_BODY = [
  'components/common/inputs/ColorPickerInput/ColorPickerModal.tsx',
  'components/common/inputs/IconPickerInput/IconPickerModal.tsx',
  'components/features/graphs/CanvasOverlay/OverlaySelectionView.tsx',
  'screens/enterstack/ColdInstallScreen.tsx',
];

/** An indented `const x = StyleSheet.create({`: made inside something, not at module level. */
const INDENTED_CREATE = /^[ \t]+(?:export )?const \w+ = StyleSheet\.create\(/m;

describe('style sheets', () => {
  const files = sourceFiles(SRC).map((path) => ({
    path: relative(path),
    source: readFileSync(path, 'utf8'),
  }));

  it('are not created inside a component, apart from the few listed', () => {
    const offenders = files
      .filter(({ source }) => INDENTED_CREATE.test(source))
      .map(({ path }) => path)
      .sort();

    expect(offenders).toEqual([...BUILT_IN_THE_BODY].sort());
  });

  it('read the theme through useThemedStyles imported by path, which keeps tests that mock the barrel working', () => {
    const offenders = files
      .filter(
        ({ source }) =>
          /import \{[^}]*\buseThemedStyles\b[^}]*\} from '(?:\.\.?\/)+theme'|from '@\/src\/theme';/.test(
            source,
          ) &&
          /useThemedStyles/.test(source) &&
          !/theme\/useThemedStyles'/.test(source),
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('never leave a listed exception that has since been fixed', () => {
    const stale = BUILT_IN_THE_BODY.filter((path) => {
      const file = files.find((f) => f.path === path);
      return !file || !INDENTED_CREATE.test(file.source);
    });

    expect(stale).toEqual([]);
  });
});
