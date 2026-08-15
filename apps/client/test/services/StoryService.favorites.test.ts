/** @jest-environment node */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database, { favoriteBehavior: 'individual' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService favorites', () => {
  it('keeps individual favorites in their per-user relation and decorates story reads', async () => {
    const service = createStoryService(database.db);

    await service.updateStoryFavoriteStatus('reader-1', TEST_STORY_ID, true);

    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ isFavorite: false }),
    );
    expect(await database.db.query.favorites.findFirst()).toEqual(
      expect.objectContaining({ entityId: TEST_STORY_ID, userId: 'reader-1', isDeleted: false }),
    );
    expect(await service.getStoryById(TEST_STORY_ID, 'reader-1')).toEqual(
      expect.objectContaining({ isFavorite: true }),
    );
    await expect(service.getAllStories('reader-1')).resolves.toEqual([
      expect.objectContaining({ id: TEST_STORY_ID, isFavorite: true }),
    ]);
  });

  it('persists a global favorite on the story and skips a no-op request', async () => {
    await database.db
      .update(schema.stories)
      .set({ favoriteBehavior: 'global' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const service = createStoryService(database.db);

    await service.updateStoryFavoriteStatus('reader-1', TEST_STORY_ID, true);
    await service.updateStoryFavoriteStatus('reader-1', TEST_STORY_ID, true);

    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ isFavorite: true, version: 2 }),
    );
    expect(await database.db.query.favorites.findMany()).toEqual([]);
  });
});
