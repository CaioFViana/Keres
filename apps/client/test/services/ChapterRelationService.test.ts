/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createChapterRelationService } from '../../src/services/storymanagement/ChapterRelationService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The story's chronology.
 *
 * Two things carry the weight here and neither is obvious from the shape of the table. First, the
 * ids are a **sequence, not a pair**: `before` and `during` are directional, so unlike character
 * relations these are never sorted - sorting would reverse half of what a writer states. Second, a
 * pair holds **one live statement**, which is what makes "A before B" and "B before A" impossible to
 * hold at once; a direct contradiction cannot be stored at all.
 */

let database: TestDatabase;

const service = () => createChapterRelationService(database.db);

const seedContainer = async (id: string, index: number, type: 'chapter' | 'event' = 'chapter') => {
  await database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: id,
    index,
    type,
    ...entityBase,
    deletedAt: null,
  });
};

const relate = (
  chapter1Id: string,
  chapter2Id: string,
  relationType: 'before' | 'during' | 'overlaps' | 'simultaneous' = 'before',
) =>
  service().createRelation(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    chapter1Id,
    chapter2Id,
    relationType,
  });

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const lastOperation = async () => (await operations()).at(-1);

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedContainer('chapter-1', 1);
  await seedContainer('chapter-2', 2);
  await seedContainer('event-1', 1, 'event');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('stating a chronology', () => {
  it('records it and logs a create for the ChapterRelation entity', async () => {
    const relation = await relate('event-1', 'chapter-1');

    expect(relation).toMatchObject({
      chapter1Id: 'event-1',
      chapter2Id: 'chapter-1',
      relationType: 'before',
      version: 1,
    });
    const operation = await lastOperation();
    expect(operation).toMatchObject({
      operationType: 'create',
      entityType: 'ChapterRelation',
      entityId: relation.id,
    });
  });

  /**
   * The direction survives the write. Sorting the ids - which is what the character relations do -
   * would turn "the war was before chapter 1" into "chapter 1 was before the war" whenever the ids
   * happened to sort the other way.
   */
  it('keeps the ids in the order they were given', async () => {
    const relation = await relate('event-1', 'chapter-1');
    const stored = await database.db.query.chapterRelations.findFirst({
      where: eq(schema.chapterRelations.id, relation.id),
    });

    expect(stored?.chapter1Id).toBe('event-1');
    expect(stored?.chapter2Id).toBe('chapter-1');
  });

  it('relates two chapters, which is a flashback', async () => {
    const relation = await relate('chapter-2', 'chapter-1');
    expect(relation.chapter1Id).toBe('chapter-2');
  });

  it('refuses to relate a container to itself', async () => {
    await expect(relate('chapter-1', 'chapter-1')).rejects.toThrow(/itself/i);
  });
});

describe('one statement per pair', () => {
  it('refuses a second statement about the same pair', async () => {
    await relate('event-1', 'chapter-1');
    await expect(relate('event-1', 'chapter-1', 'during')).rejects.toThrow(/already have/i);
  });

  /**
   * The point of the rule: with one row per unordered pair, the two directions cannot coexist, so a
   * direct contradiction is unstorable rather than merely discouraged.
   */
  it('refuses the same pair stated the other way round', async () => {
    await relate('event-1', 'chapter-1');
    await expect(relate('chapter-1', 'event-1')).rejects.toThrow(/already have/i);
  });

  it('frees the pair once the statement is deleted', async () => {
    const relation = await relate('event-1', 'chapter-1');
    await service().deleteRelation(TEST_USER_ID, relation.id);

    await expect(relate('chapter-1', 'event-1')).resolves.toMatchObject({
      chapter1Id: 'chapter-1',
    });
  });

  it('leaves a different pair alone', async () => {
    await relate('event-1', 'chapter-1');
    await expect(relate('event-1', 'chapter-2')).resolves.toBeTruthy();
  });
});

describe('changing a statement', () => {
  it('turns a before into a during without touching the pair', async () => {
    const relation = await relate('event-1', 'chapter-1');

    const updated = await service().updateRelation(TEST_USER_ID, relation.id, {
      relationType: 'during',
    });

    expect(updated).toMatchObject({ relationType: 'during', version: 2 });
    expect(await lastOperation()).toMatchObject({
      operationType: 'update',
      entityType: 'ChapterRelation',
    });
  });

  /** Reversing the direction is an edit to the same pair, not a new statement about it. */
  it('reverses the direction by swapping the two ends', async () => {
    const relation = await relate('event-1', 'chapter-1');

    const updated = await service().updateRelation(TEST_USER_ID, relation.id, {
      chapter1Id: 'chapter-1',
      chapter2Id: 'event-1',
    });

    expect(updated).toMatchObject({ chapter1Id: 'chapter-1', chapter2Id: 'event-1' });
  });

  it('refuses to move it onto a pair that already has one', async () => {
    await relate('event-1', 'chapter-1');
    const other = await relate('event-1', 'chapter-2');

    await expect(
      service().updateRelation(TEST_USER_ID, other.id, { chapter2Id: 'chapter-1' }),
    ).rejects.toThrow(/already have/i);
  });

  it('records nothing when nothing changed', async () => {
    const relation = await relate('event-1', 'chapter-1');
    const before = (await operations()).length;

    await service().updateRelation(TEST_USER_ID, relation.id, { relationType: 'before' });

    expect((await operations()).length).toBe(before);
  });
});

describe('removing a statement', () => {
  it('soft deletes it and logs the tombstone', async () => {
    const relation = await relate('event-1', 'chapter-1');

    await service().deleteRelation(TEST_USER_ID, relation.id);

    const row = await database.db.query.chapterRelations.findFirst({
      where: eq(schema.chapterRelations.id, relation.id),
    });
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
    expect(payloadOf((await lastOperation())!)).toMatchObject({ isDeleted: true });
  });

  it('leaves it out of the reads', async () => {
    const relation = await relate('event-1', 'chapter-1');
    await service().deleteRelation(TEST_USER_ID, relation.id);

    expect(await service().getById(relation.id)).toBeUndefined();
    expect(await service().getRelationsForStory(TEST_STORY_ID)).toEqual([]);
  });

  it('is a no-op for one that never existed', async () => {
    const before = (await operations()).length;
    await service().deleteRelation(TEST_USER_ID, 'ghost');
    expect((await operations()).length).toBe(before);
  });
});

describe('reading', () => {
  it('finds the statements a container is on either side of', async () => {
    await relate('event-1', 'chapter-1');
    await relate('chapter-2', 'event-1');

    const found = await service().getRelationsForChapter('event-1');
    expect(found).toHaveLength(2);
  });
});

describe('a read-only story', () => {
  beforeEach(async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'server-1', myRole: 'reader' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
  });

  it('refuses to state one', async () => {
    await expect(relate('event-1', 'chapter-1')).rejects.toThrow();
  });
});
