/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { loadEntityOptions } from '../../src/utils/entityOptions';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * Events are mentionable, and they are mentionable for free.
 *
 * `MENTIONABLE_ENTITY_TYPES` already includes `Chapter`, entity options read the raw `name`, and
 * `ENTITY_ROUTES` sends a Chapter to its detail screen by id - so an event auto-links and navigates
 * with no code of its own. That is worth a test precisely *because* nothing had to be written for
 * it: the way to lose it is for somebody to add a `type = 'chapter'` filter here while tidying up,
 * and every link to an era would quietly stop existing.
 */

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.chapters).values([
    {
      id: 'chapter-1',
      storyId: TEST_STORY_ID,
      name: 'The Harbour',
      index: 1,
      type: 'chapter',
      ...entityBase,
      deletedAt: null,
    },
    {
      id: 'event-1',
      storyId: TEST_STORY_ID,
      name: 'The Three Hundred Year War',
      index: 1,
      type: 'event',
      ...entityBase,
      deletedAt: null,
    },
  ]);
});

afterEach(() => database.close());

describe('entity options for chapters', () => {
  it('offers events alongside chapters', async () => {
    const options = await loadEntityOptions(database.db, TEST_STORY_ID, 'Chapter');

    expect(options.map((option) => option.name).sort()).toEqual([
      'The Harbour',
      'The Three Hundred Year War',
    ]);
  });

  /** The name is the whole label: no index is printed, which is what makes an event fit. */
  it('offers the name alone, with no number attached', async () => {
    const options = await loadEntityOptions(database.db, TEST_STORY_ID, 'Chapter');

    expect(options.find((option) => option.id === 'chapter-1')?.name).toBe('The Harbour');
  });

  it('still leaves out a deleted event', async () => {
    await database.db
      .update(schema.chapters)
      .set({ isDeleted: true })
      .where(eq(schema.chapters.id, 'event-1'));

    const options = await loadEntityOptions(database.db, TEST_STORY_ID, 'Chapter');
    expect(options.map((option) => option.id)).toEqual(['chapter-1']);
  });
});
