/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { loadBoardEntitySummary } from '../../src/utils/boardEntitySummary';
import { seedLocalStory, TEST_STORY_ID, entityBase } from '../helpers/storyTestData';
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
    await database.db.insert(schema.worldRules).values({
      id: 'rule-1',
      storyId: TEST_STORY_ID,
      title: 'A magia é proibida',
      description: 'Ninguém pode lançar feitiços.',
      ...entityBase,
    });
    await database.db.insert(schema.notes).values({
      id: 'note-1',
      storyId: TEST_STORY_ID,
      title: 'Diário de Frodo',
      body: 'Hoje atravessamos o rio.',
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

  it('returns the world rule title and description', async () => {
    await expect(loadBoardEntitySummary(database.db, 'WorldRule', 'rule-1')).resolves.toEqual({
      title: 'A magia é proibida',
      details: 'Ninguém pode lançar feitiços.',
    });
  });

  it('returns the note title and body', async () => {
    await expect(loadBoardEntitySummary(database.db, 'Note', 'note-1')).resolves.toEqual({
      title: 'Diário de Frodo',
      details: 'Hoje atravessamos o rio.',
    });
  });

  it('returns null for an entity that does not exist', async () => {
    await expect(loadBoardEntitySummary(database.db, 'Character', 'ghost')).resolves.toBeNull();
  });
});
