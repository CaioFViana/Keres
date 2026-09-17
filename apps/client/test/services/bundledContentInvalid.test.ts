/**
 * @jest-environment node
 */
jest.mock('../../src/exampleStories/generated/registry', () => ({
  __esModule: true,
  exampleStoryRegistry: [
    { slug: 'broken', languages: [{ language: 'en', story: { nope: true } }] },
  ],
}));
jest.mock('../../src/shippedPacks/generated/registry', () => ({
  __esModule: true,
  shippedPackRegistry: [{ slug: 'broken', languages: [{ language: 'en', pack: { nope: true } }] }],
}));

import { createExampleStoryService } from '../../src/services/storymanagement/ExampleStoryService';
import { createShippedPackService } from '../../src/services/storymanagement/ShippedPackService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The bundled-content guards against a corrupt registry entry.
 *
 * The happy paths install real generated content (`ExampleStoryService.test.ts`,
 * `ShippedPackService.test.ts`). The registries are statically imported data, so the only way to
 * reach the validation-failure branches is to substitute the module - which is exactly what a
 * corrupt generated file would look like at runtime. Both services must report `invalid_content`
 * rather than throwing into the install screen.
 */

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('bundled content validation failures', () => {
  it('reports invalid_content for a corrupt example story instead of throwing', async () => {
    const result = await createExampleStoryService(database.db).installExampleStory(
      'local-user',
      'broken',
      'en',
    );

    expect(result).toEqual({ status: 'invalid_content' });
  });

  it('reports invalid_content for a corrupt shipped pack instead of throwing', async () => {
    const result = await createShippedPackService(database.db).installShippedPack('broken', 'en');

    expect(result).toEqual({ status: 'invalid_content' });
  });

  it('lists the registry entries verbatim', async () => {
    expect(createExampleStoryService(database.db).listExampleStories()).toHaveLength(1);
    expect(createShippedPackService(database.db).listShippedPacks()).toHaveLength(1);
  });
});
