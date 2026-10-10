/** @jest-environment node */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../../src');
const NAVIGATION = join(SRC, 'navigation');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

const relative = (path: string) => path.slice(SRC.length + 1).replace(/\\/g, '/');

/** What puts a screen's name in the browser tab: one of these, called by the screen itself. */
const TITLE_CALL = /useScreenHeader\(|useEntityFormHeader\(|useDocumentTitle\(|setDocumentTitle\(/;

/** The screens the navigators register (a navigator wrapping more screens is not one of them). */
function registeredScreens(): { route: string; file: string }[] {
  const found: { route: string; file: string }[] = [];
  for (const entry of readdirSync(NAVIGATION).filter((name) => name.endsWith('.tsx'))) {
    const source = readFileSync(join(NAVIGATION, entry), 'utf8');
    const imports = new Map<string, string>();
    for (const match of source.matchAll(/import\s+(\w+)\s+from\s+'([^']+)'/g)) {
      imports.set(match[1], match[2]);
    }
    for (const tag of source.matchAll(/<\w+\.Screen\s+name="(\w+)"([\s\S]*?)\/>/g)) {
      const component = tag[2].match(/component=\{(\w+)\}/)?.[1];
      const specifier = component ? imports.get(component) : undefined;
      if (!specifier) continue;
      const target = specifier.startsWith('@/src/')
        ? join(SRC, specifier.slice(6))
        : resolve(NAVIGATION, specifier);
      const file = [`${target}.tsx`, `${target}.ts`, join(target, 'index.tsx')].find(existsSync);
      if (!file) continue;
      // A nested navigator is a container: its own screens are the ones that carry titles.
      if (/create\w*Navigator</.test(readFileSync(file, 'utf8'))) continue;
      found.push({ route: tag[1], file });
    }
  }
  return found;
}

/**
 * The text in the browser tab is set by the screens, on purpose and by name. React Navigation's own
 * default - the focused route's name - is what used to show `DeviceIndex`, `PackList` and
 * `ColdInstallScreen` whenever a screen put its title on a parent navigator.
 */
describe('the web page title', () => {
  it('is never left to React Navigation, which would show the route name', () => {
    const source = readFileSync(join(NAVIGATION, 'AppNavigator.tsx'), 'utf8');

    expect(source).toMatch(/documentTitle=\{\{\s*enabled:\s*false\s*\}\}/);
  });

  it('is set by every screen a navigator registers', () => {
    const screens = registeredScreens();
    expect(screens.length).toBeGreaterThan(80);

    const offenders = screens
      .filter(({ file }) => !TITLE_CALL.test(readFileSync(file, 'utf8')))
      .map(({ route, file }) => `${route} (${relative(file)})`)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('is only ever written through `setDocumentTitle`', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => relative(path) !== 'utils/documentTitle.ts')
      .filter((path) => /document\.title\s*=/.test(readFileSync(path, 'utf8')))
      .map(relative)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('is never a route name: a title is words, not an identifier', () => {
    const titles = /(?:title:|documentTitle:|setDocumentTitle\(|useDocumentTitle\()\s*'([^']+)'/g;
    const offenders = sourceFiles(join(SRC, 'screens'))
      .flatMap((path) =>
        [...readFileSync(path, 'utf8').matchAll(titles)]
          .map((match) => match[1])
          .filter((title) => /^[A-Z][a-z0-9]+([A-Z][a-z0-9]*)+$/.test(title))
          .map((title) => `${relative(path)}: ${title}`),
      )
      .sort();

    expect(offenders).toEqual([]);
  });
});
