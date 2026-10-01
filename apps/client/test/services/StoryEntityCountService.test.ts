/**
 * @jest-environment node
 */
import { getTierCountedEntityTypes, TIER_EXEMPT_ENTITY_TYPES } from '@keres/shared';
import { getTableColumns } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { ENTITY_TABLES, getEntityTable } from '../../src/services/entityTableRegistry';
import { createStoryEntityCountService } from '../../src/services/storymanagement/StoryEntityCountService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The count the plan's entity ceiling sees, reported by the client. It is a copy of the server's rule only
 * through `getTierCountedEntityTypes`, so what matters here is that every type that rule names can really
 * be counted in the local database, and that the counting skips what the server skips.
 */
let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});
afterEach(() => database.close());

const insertCharacter = (id: string, over: Partial<typeof schema.characters.$inferInsert> = {}) =>
  database.db.insert(schema.characters).values({
    id,
    storyId: TEST_STORY_ID,
    name: id,
    ...entityBase,
    deletedAt: null,
    ...over,
  } as typeof schema.characters.$inferInsert);

describe('what the count covers', () => {
  it('names only types the local database can count, and never the exempt ones', () => {
    const counted = getTierCountedEntityTypes();

    expect(counted.length).toBeGreaterThan(30);
    for (const type of counted) {
      const columns = Object.keys(getTableColumns(getEntityTable(type) as never));
      expect([type, columns.includes('storyId'), columns.includes('isDeleted')]).toEqual([
        type,
        true,
        true,
      ]);
    }
    for (const exempt of TIER_EXEMPT_ENTITY_TYPES) {
      expect(counted).not.toContain(exempt);
      expect(Object.hasOwn(ENTITY_TABLES, exempt)).toBe(true);
    }
  });
});

describe('createStoryEntityCountService', () => {
  it('counts one per live row of each type and sums them', async () => {
    await insertCharacter('char-1');
    await insertCharacter('char-2');
    await database.db.insert(schema.locations).values({
      id: 'loc-1',
      storyId: TEST_STORY_ID,
      name: 'Harbour',
      ...entityBase,
      deletedAt: null,
    } as typeof schema.locations.$inferInsert);

    const counts = await createStoryEntityCountService(database.db).countForStory(TEST_STORY_ID);

    expect(counts).toEqual({ total: 3, byType: { Character: 2, Location: 1 } });
  });

  it('leaves out deleted rows, other stories, and the story itself', async () => {
    await insertCharacter('char-live');
    await insertCharacter('char-gone', { isDeleted: true });
    await seedLocalStory(database, { id: 'other-story' });
    await insertCharacter('char-elsewhere', { storyId: 'other-story' });

    const counts = await createStoryEntityCountService(database.db).countForStory(TEST_STORY_ID);

    expect(counts).toEqual({ total: 1, byType: { Character: 1 } });
  });

  it('is empty for a story with nothing in it', async () => {
    const counts = await createStoryEntityCountService(database.db).countForStory(TEST_STORY_ID);

    expect(counts).toEqual({ total: 0, byType: {} });
  });
});
