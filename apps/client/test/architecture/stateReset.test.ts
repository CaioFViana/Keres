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
    const entityStoreModules = readdirSync(stateRoot)
      .filter(
        (file) =>
          file.endsWith('Store.ts') &&
          file !== 'resetAllClientStores.ts' &&
          file !== 'createEntityStore.ts',
      )
      .filter((file) => readFileSync(join(stateRoot, file), 'utf8').includes('createEntityStore<'))
      .map((file) => file.replace(/Store\.ts$/, 'Store'))
      .sort();

    const resetEntityStoreModules = Array.from(
      resetSource.matchAll(/from '\.\/(.+Store)'/g),
      ([, module]) => module,
    )
      .filter((module) => entityStoreModules.includes(module))
      .sort();

    expect(resetEntityStoreModules).toEqual(entityStoreModules);
  });
});
