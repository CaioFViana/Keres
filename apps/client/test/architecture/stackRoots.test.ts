import fs from 'fs';
import path from 'path';

const navigationDir = path.resolve(__dirname, '../../src/navigation');

/** Stacks whose header the main drawer draws; the story-selection drawer keeps its own list. */
const MAIN_SYSTEM_STACK_FILES = [
  'MainSystemStacks.tsx',
  'ArcsStack.tsx',
  'CalendarsStack.tsx',
  'HelpStack.tsx',
  'StatsStack.tsx',
  'StoryDevicesStack.tsx',
  'StorySettingsStack.tsx',
  'StoryShareStack.tsx',
];

const read = (file: string) => fs.readFileSync(path.join(navigationDir, file), 'utf8');

/** The names in `mainSystemStackRootScreens`, read from the source (the module pulls in the whole navigator). */
function declaredRoots(): Set<string> {
  const source = read('MainSystemDrawerHelpers.tsx');
  const body = source.split('mainSystemStackRootScreens = new Set([')[1]?.split(']);')[0] ?? '';
  return new Set([...body.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]));
}

/** The first screen of every `<X.Navigator>` in a file - the stack's root. */
function stackRoots(file: string): { navigator: string; screen: string }[] {
  return [...read(file).matchAll(/<(\w+)\.Navigator[^>]*>\s*<\1\.Screen\s+name="(\w+)"/g)].map(
    (match) => ({ navigator: match[1], screen: match[2] }),
  );
}

describe('the roots of the main drawer stacks', () => {
  it('finds the stacks it is meant to check', () => {
    const all = MAIN_SYSTEM_STACK_FILES.flatMap(stackRoots);

    // A pattern that stops matching must fail here, not pass by checking nothing.
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(all.map((root) => root.screen)).toEqual(
      expect.arrayContaining(['Characters', 'SketchList', 'SongList', 'StoryArcList']),
    );
  });

  it.each(MAIN_SYSTEM_STACK_FILES)(
    '%s: every stack root is listed, so the header draws no back arrow on it',
    (file) => {
      const roots = declaredRoots();
      const missing = stackRoots(file)
        .map((root) => root.screen)
        .filter((screen) => !roots.has(screen));

      expect(missing).toEqual([]);
    },
  );
});
