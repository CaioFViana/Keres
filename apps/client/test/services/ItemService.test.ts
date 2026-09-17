/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The item service's listing: search, favorite filter, column sort and whole-story read.
 *
 * The favorite filter carries a regression comment in the source - it once compared against the
 * plural forms no caller sends - and the singular-form case already lives in
 * `coreEntityListingServices.test.ts`. Here are the rest of the list: the name search, the
 * mirrored not-favorite filter, the dynamic column sort with its unknown-key warning, and the
 * `getAllByStoryId` read with its missing-id shortcut. CRUD lives in
 * `coreEntityLifecycleServices.test.ts`.
 *
 * One path is deliberately not covered: the catch in `getAllByStoryId`, which needs the database
 * itself to fail.
 */

let database: TestDatabase;

const seedItem = async (id: string, overrides: Record<string, unknown> = {}): Promise<void> => {
  await database.db.insert(schema.items).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Item ${id}`,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('ItemService listing', () => {
  it('matches the search term against the name case-insensitively', async () => {
    const service = createItemService(database.db);
    await seedItem('a', { name: 'Brass compass' });
    await seedItem('b', { name: 'Coil of rope' });

    expect(
      (await service.getItemsByStoryId(TEST_STORY_ID, 'COMPASS')).map((item) => item.id),
    ).toEqual(['a']);
  });

  it('excludes non-favorites on request', async () => {
    const service = createItemService(database.db);
    await seedItem('a', { isFavorite: true });
    await seedItem('b', { isFavorite: false });

    expect(
      (await service.getItemsByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'not-favorite')).map(
        (item) => item.id,
      ),
    ).toEqual(['b']);
  });

  it('narrows by advanced criteria', async () => {
    const service = createItemService(database.db);
    await seedItem('a', { name: 'Brass compass' });
    await seedItem('b', { name: 'Coil of rope' });

    const rows = await service.getItemsByStoryId(TEST_STORY_ID, undefined, null, 'asc', 'all', {
      name: 'rope',
    });

    expect(rows.map((item) => item.id)).toEqual(['b']);
  });

  it('sorts by any column and warns on an unknown key', async () => {
    const service = createItemService(database.db);
    await seedItem('a', { name: 'Bravo' });
    await seedItem('b', { name: 'Alpha' });

    expect(
      (await service.getItemsByStoryId(TEST_STORY_ID, undefined, 'name', 'asc')).map(
        (item) => item.id,
      ),
    ).toEqual(['b', 'a']);
    expect(
      (await service.getItemsByStoryId(TEST_STORY_ID, undefined, 'nope', 'asc')).map(
        (item) => item.id,
      ),
    ).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith('Unknown sortBy field: nope');
  });

  it('orders by creation time when no sort is requested', async () => {
    const service = createItemService(database.db);
    await seedItem('a', { createdAt: new Date('2026-02-01T00:00:00.000Z') });
    await seedItem('b', { createdAt: new Date('2026-01-01T00:00:00.000Z') });

    expect((await service.getItemsByStoryId(TEST_STORY_ID)).map((item) => item.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('returns every live item of the story, and nothing without a story id', async () => {
    const service = createItemService(database.db);
    await seedItem('a');
    await seedItem('gone', { isDeleted: true });

    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((item) => item.id)).toEqual(['a']);
    expect(await service.getAllByStoryId('')).toEqual([]);
  });
});
