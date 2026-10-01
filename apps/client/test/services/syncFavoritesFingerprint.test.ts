/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { computeLocalFavoritesFingerprint } from '../../src/services/sync/syncFavoritesFingerprint';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const favorite = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  storyId: TEST_STORY_ID,
  entityId: `entity-${id}`,
  entityType: 'Character',
  userId: TEST_USER_ID,
  ...entityBase,
  ...overrides,
});

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => {
  database.close();
});

describe('computeLocalFavoritesFingerprint', () => {
  it('reports zeros for a story with no favorites', async () => {
    await expect(computeLocalFavoritesFingerprint(database.db, TEST_STORY_ID)).resolves.toEqual({
      count: 0,
      maxVersion: 0,
    });
  });

  it('counts every row and takes the highest version, tombstones included', async () => {
    await database.db
      .insert(schema.favorites)
      .values([
        favorite('fav-1', { version: 1 }),
        favorite('fav-2', { version: 4 }),
        favorite('fav-3', { version: 2, isDeleted: true }),
      ]);

    await expect(computeLocalFavoritesFingerprint(database.db, TEST_STORY_ID)).resolves.toEqual({
      count: 3,
      maxVersion: 4,
    });
  });

  it('ignores favorites of other stories', async () => {
    await database.db
      .insert(schema.favorites)
      .values([
        favorite('fav-1', { version: 2 }),
        favorite('fav-other', { storyId: 'another-story', version: 9 }),
      ]);

    await expect(computeLocalFavoritesFingerprint(database.db, TEST_STORY_ID)).resolves.toEqual({
      count: 1,
      maxVersion: 2,
    });
  });
});
