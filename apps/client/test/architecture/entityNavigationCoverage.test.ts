/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SOURCE_ROOT = resolve(__dirname, '../../src');
const navigation = readFileSync(join(SOURCE_ROOT, 'navigation/MainSystemStack.tsx'), 'utf8');
const entityNavigation = readFileSync(join(SOURCE_ROOT, 'utils/entityNavigation.ts'), 'utf8');

const valuesOf = (property: 'stack' | 'screen') =>
  Array.from(
    entityNavigation.matchAll(new RegExp(`${property}: '([^']+)'`, 'g')),
    ([, value]) => value,
  ).sort();
const drawerRoutes = new Set(
  Array.from(navigation.matchAll(/<Drawer\.Screen\s+name="([^"]+)"/g), ([, name]) => name),
);
const stackRoutes = new Set(
  Array.from(navigation.matchAll(/<[A-Za-z]+\.Screen\s+name="([^"]+)"/g), ([, name]) => name),
);

/**
 * Entity links are intentionally centralised. A stale mapping compiles because navigation is
 * dynamic, but then a backlink or graph node sends the user to a dead destination at runtime.
 */
describe('entity navigation coverage', () => {
  it('targets only registered drawer stacks', () => {
    expect(valuesOf('stack').filter((stack) => !drawerRoutes.has(stack))).toEqual([]);
  });

  it('targets only registered detail screens', () => {
    expect(valuesOf('screen').filter((screen) => !stackRoutes.has(screen))).toEqual([]);
  });
});
