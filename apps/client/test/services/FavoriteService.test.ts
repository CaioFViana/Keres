/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createFavoriteService } from '../../src/services/storymanagement/FavoriteService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('FavoriteService', () => {
  it('keeps individual favorites private and restores the same tombstone when re-favorited', async () => {
    const service = createFavoriteService(database.db);

    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);
    expect(
      await service.isFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, false),
    ).toBe(true);
    expect(
      await service.decorateEntities(TEST_STORY_ID, 'Character', TEST_USER_ID, [
        { id: 'char-1', isFavorite: false },
        { id: 'char-2', isFavorite: true },
      ]),
    ).toEqual([
      { id: 'char-1', isFavorite: true },
      { id: 'char-2', isFavorite: false },
    ]);

    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, false);
    await service.setFavorite(TEST_STORY_ID, 'char-1', 'Character', TEST_USER_ID, true);
    expect(await database.db.select().from(schema.favorites).all()).toEqual([
      expect.objectContaining({ isDeleted: false, version: 3 }),
    ]);
  });
});
