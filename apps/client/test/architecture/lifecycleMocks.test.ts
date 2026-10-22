/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A test that replaces the entity refresh lifecycle keeps only the half it remembered to
 * re-implement: when a hook starts using the other half (the event subscriptions), the mock hands
 * back `undefined` and the suite fails somewhere that has nothing to do with the change. The real
 * lifecycle is a `useEffect` and the real emitter, so a test drives it with `emitEntityEvent`
 * (test/helpers/entityEvents.ts). Replacing it is for the tests that assert how it is called.
 */

const TEST_ROOT = resolve(__dirname, '..');
const MOCKED_ON_PURPOSE = [
  // Asserts that the initializer starts its loads through the lifecycle.
  'components/ScopeASyncInitializer.test.tsx',
  // Keeps the provider from loading its matchers while it renders.
  'mentions/MentionMatcherProvider.test.tsx',
];

function listTests(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listTests(path);
    return /\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('lifecycle mocks in tests', () => {
  it('replace the entity refresh lifecycle only where the test is about it', () => {
    const files = listTests(TEST_ROOT);
    expect(files.length).toBeGreaterThan(500);

    const offenders = files
      .filter((path) =>
        /jest\.mock\(\s*['"]@\/src\/hooks\/lists\/useEntityRefreshLifecycle['"]/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(TEST_ROOT, path).replace(/\\/g, '/'))
      .filter((path) => !MOCKED_ON_PURPOSE.includes(path))
      .sort();

    expect(offenders).toEqual([]);
  });
});
