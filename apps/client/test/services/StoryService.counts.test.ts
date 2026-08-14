/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

afterEach(() => database.close());

it('counts only live stories and entities in the requested story', async () => {
  await database.db.insert(schema.stories).values([
    {
      id: 'branching-story',
      userId: 'local-user',
      title: 'Ramos',
      type: 'branching',
      favoriteBehavior: 'individual',
      ...entityBase,
    },
    {
      id: 'deleted-story',
      userId: 'local-user',
      title: 'Removida',
      type: 'branching',
      favoriteBehavior: 'individual',
      ...entityBase,
      isDeleted: true,
    },
  ]);
  await database.db.insert(schema.characters).values([
    { id: 'live', storyId: TEST_STORY_ID, name: 'Vivo', ...entityBase },
    {
      id: 'deleted',
      storyId: TEST_STORY_ID,
      name: 'Removido',
      ...entityBase,
      isDeleted: true,
    },
  ]);

  const service = createStoryService(database.db);
  expect(await service.getStoryCounts()).toEqual({ totalStories: 2, branchingStories: 1 });
  expect(await service.getCharacterCount(TEST_STORY_ID)).toBe(1);
});
