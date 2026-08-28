/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { loadBoardEntitySummary } from '../../src/utils/boardEntitySummary';
import {
  seedLocalStory,
  TEST_STORY_ID,
  entityBase,
} from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

describe('loadBoardEntitySummary', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await seedLocalStory(database);
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: TEST_STORY_ID,
      name: 'Frodo',
      description: 'O portador do anel.',
      ...entityBase,
    });
  });

  afterAll(() => database.close());

  it('returns the character title and description', async () => {
    await expect(loadBoardEntitySummary(database.db, 'Character', 'char-1')).resolves.toEqual({
      title: 'Frodo',
      details: 'O portador do anel.',
    });
  });

  it('returns null for an entity that does not exist', async () => {
    await expect(loadBoardEntitySummary(database.db, 'Character', 'ghost')).resolves.toBeNull();
  });

  it('returns null for entity kinds without a summary', async () => {
    await expect(loadBoardEntitySummary(database.db, 'Note', 'nope')).resolves.toBeNull();
  });
});