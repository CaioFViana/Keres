/**
 * @jest-environment node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const stateRoot = resolve(__dirname, '../../src/state');
const resetSource = readFileSync(join(stateRoot, 'resetAllClientStores.ts'), 'utf8');

/**
 * Entity stores retain a SQLite handle and rows. A database reset (logout, account replacement or
 * server departure) must clear every one of them; leaving just one behind is enough to expose rows
 * from the previous account. The list is derived from the factory usage, so a newly added entity store
 * makes this test fail until its reset has been deliberately wired.
 */
describe('database-bound store reset architecture', () => {
  it('resets every store created through the entity-store factory', () => {
    // Stores sit in subfolders by domain (`state/story/chapterStore.ts`); the reset imports them by that path.
    const entityStoreModules = readdirSync(stateRoot, { recursive: true, encoding: 'utf8' })
      .map((file) => file.replace(/\\/g, '/'))
      .filter(
        (file) =>
          file.endsWith('Store.ts') &&
          !file.endsWith('createEntityStore.ts') &&
          !file.endsWith('resetAllClientStores.ts'),
      )
      .filter((file) => readFileSync(join(stateRoot, file), 'utf8').includes('createEntityStore<'))
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    const resetEntityStoreModules = Array.from(
      resetSource.matchAll(/from '\.\/(.+Store)'/g),
      ([, module]) => module,
    )
      .filter((module) => entityStoreModules.includes(module))
      .sort();

    // An empty list would pass the equality below without checking anything.
    expect(entityStoreModules.length).toBeGreaterThan(0);
    expect(resetEntityStoreModules).toEqual(entityStoreModules);
  });
});
