/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import { asc, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The chapter service, and above all the **numbering**.
 *
 * `chapters.index` is the story's narrative spine, derived 1..N from each chapter's `rank` (events
 * keep a numbering of their own).
 *
 * The other half is the operation log. Every mutation here writes one, and a mutation that records
 * the wrong entity, type or payload fails silently: the local row looks right and the other device
 * never learns about it.
 *
 * Three paths are deliberately not covered, because covering them would mean faking the impossible:
 * the `number` branch of the advanced search (`entityFieldMetadata['Chapter']` declares no numeric
 * field, so no caller can reach it) and the two "failed to retrieve the row we just wrote" throws in
 * `updateChapter`/`deleteChapter`.
 */

let database: TestDatabase;

const chapterService = () => createChapterService(database.db);

const seedChapter = async (id: string, index: number, overrides = {}) => {
  await database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Chapter ${index}`,
    index,
    ...entityBase,
    deletedAt: null,
    ...overrides,
  });
};

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const lastOperation = async () => {
  const all = await operations();
  return all[all.length - 1];
};

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

const indexesInOrder = async () =>
  (
    await database.db
      .select({ id: schema.chapters.id, index: schema.chapters.index })
      .from(schema.chapters)
      .where(eq(schema.chapters.isDeleted, false))
      .orderBy(asc(schema.chapters.index))
      .all()
  ).map((row) => `${row.id}:${row.index}`);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('creating a chapter', () => {
  it('stores it and logs a create for the Chapter entity', async () => {
    const created = await chapterService().createChapter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'The Fall',
      index: 1,
    });

    expect(created).toMatchObject({ name: 'The Fall', index: 1, version: 1, isDeleted: false });

    const operation = await lastOperation();
    expect(operation).toMatchObject({
      operationType: 'create',
      entityType: 'Chapter',
      entityId: created.id,
    });
    expect(payloadOf(operation)).toMatchObject({ name: 'The Fall', index: 1 });
  });

  /**
   * The index the caller asks for is where the chapter goes among its kind: it takes the rank of
   * that place, and the numbers follow. A number past the end lands at the end.
   */
  it('places it at the asked index among its kind, and the numbers follow', async () => {
    await seedChapter('chapter-1', 1);
    await seedChapter('chapter-2', 2);

    const created = await chapterService().createChapter(TEST_USER_ID, {
      id: 'chapter-new',
      storyId: TEST_STORY_ID,
      name: 'Inserted',
      index: 2,
    } as never);
    const appended = await chapterService().createChapter(TEST_USER_ID, {
      id: 'chapter-last',
      storyId: TEST_STORY_ID,
      name: 'Out of band',
      index: 7,
    } as never);

    expect(created.index).toBe(2);
    expect(appended.index).toBe(4);
    expect(await indexesInOrder()).toEqual([
      'chapter-1:1',
      'chapter-new:2',
      'chapter-2:3',
      'chapter-last:4',
    ]);
    // Only the new rows were recorded: nothing else moved.
    expect(
      (await operations())
        .filter((operation) => operation.entityType === 'Chapter')
        .map((operation) => operation.entityId),
    ).toEqual(['chapter-new', 'chapter-last']);
  });
});

describe('updating a chapter', () => {
  it('bumps the version and logs only the fields that changed', async () => {
    await seedChapter('chapter-1', 1);

    const updated = await chapterService().updateChapter(TEST_USER_ID, 'chapter-1', {
      name: 'Renamed',
    });

    expect(updated).toMatchObject({ name: 'Renamed', version: 2 });
    const operation = await lastOperation();
    expect(operation).toMatchObject({ operationType: 'update', entityType: 'Chapter' });
    const payload = payloadOf(operation);
    expect(payload.name).toBe('Renamed');
    expect(payload.summary).toBeUndefined();
  });

  /** An update that changes nothing must not enqueue an operation for every other device to apply. */
  it('records nothing when the values are identical', async () => {
    await seedChapter('chapter-1', 1);
    const before = (await operations()).length;

    const result = await chapterService().updateChapter(TEST_USER_ID, 'chapter-1', {
      name: 'Chapter 1',
    });

    expect(result.version).toBe(1);
    expect((await operations()).length).toBe(before);
  });

  it('refuses a chapter that does not exist', async () => {
    await expect(
      chapterService().updateChapter(TEST_USER_ID, 'ghost', { name: 'X' }),
    ).rejects.toThrow(/not found/i);
  });
});

describe('deleting a chapter', () => {
  it('soft deletes it and logs the tombstone', async () => {
    await seedChapter('chapter-1', 1);

    await chapterService().deleteChapter(TEST_USER_ID, 'chapter-1');

    const row = await database.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, 'chapter-1'),
    });
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
    expect(row?.deletedAt).toBeTruthy();

    const operation = await lastOperation();
    expect(operation).toMatchObject({ operationType: 'delete', entityType: 'Chapter' });
    expect(payloadOf(operation)).toMatchObject({ isDeleted: true, version: 2 });
  });

  it('leaves it out of the reads', async () => {
    await seedChapter('chapter-1', 1);
    await chapterService().deleteChapter(TEST_USER_ID, 'chapter-1');

    expect(await chapterService().getById('chapter-1')).toBeUndefined();
    expect(await chapterService().getAllByStoryId(TEST_STORY_ID)).toHaveLength(0);
  });

  /**
   * Deleting a chapter does **not** cascade to its scenes, and does not renumber the chapters that
   * remain. Both are the caller's job today. Asserted because the Events feature moves this code and
   * a cascade appearing by accident would delete a writer's scenes.
   */
  it('does not touch the scenes it contained; the remaining chapters close the gap', async () => {
    await seedChapter('chapter-1', 1);
    await seedChapter('chapter-2', 2);
    await database.db.insert(schema.locations).values({
      id: 'location-1',
      storyId: TEST_STORY_ID,
      name: 'The harbour',
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.scenes).values({
      id: 'scene-1',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'The arrival',
      index: 1,
      isStart: false,
      isFinish: false,
      ...entityBase,
      deletedAt: null,
    });

    await chapterService().deleteChapter(TEST_USER_ID, 'chapter-1');

    const scene = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-1'),
    });
    expect(scene?.isDeleted).toBe(false);
    expect(await indexesInOrder()).toEqual(['chapter-2:1']);
    // The numbers are derived: only the deletion itself was recorded.
    expect((await operations()).map((operation) => operation.operationType)).toEqual(['delete']);
  });

  it('is a no-op for a chapter that never existed', async () => {
    const before = (await operations()).length;
    await chapterService().deleteChapter(TEST_USER_ID, 'ghost');
    expect((await operations()).length).toBe(before);
  });
});

describe('reordering chapters', () => {
  beforeEach(async () => {
    await seedChapter('chapter-1', 1);
    await seedChapter('chapter-2', 2);
    await seedChapter('chapter-3', 3);
  });

  it('renumbers to 1..N with no holes', async () => {
    await chapterService().reorderChapters(TEST_USER_ID, TEST_STORY_ID, [
      { id: 'chapter-3', newIndex: 1 },
      { id: 'chapter-1', newIndex: 2 },
      { id: 'chapter-2', newIndex: 3 },
    ]);

    expect(await indexesInOrder()).toEqual(['chapter-3:1', 'chapter-1:2', 'chapter-2:3']);
  });

  /** One rank edit per chapter that moved - never a container order, never the others. */
  it('records a rank edit for the chapter that moved, and nothing else', async () => {
    await chapterService().reorderChapters(TEST_USER_ID, TEST_STORY_ID, [
      { id: 'chapter-2', newIndex: 1 },
      { id: 'chapter-1', newIndex: 2 },
      { id: 'chapter-3', newIndex: 3 },
    ]);

    const recorded = await operations();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      operationType: 'update',
      entityType: 'Chapter',
      entityId: 'chapter-2',
    });
    expect(Object.keys(payloadOf(recorded[0]!)).sort()).toEqual(['rank', 'version']);
  });

  /** The story is not the order's container any more: its version stays where it was. */
  it('leaves the story version alone and bumps only the moved chapter', async () => {
    await chapterService().reorderChapters(TEST_USER_ID, TEST_STORY_ID, [
      { id: 'chapter-1', newIndex: 1 },
      { id: 'chapter-3', newIndex: 2 },
      { id: 'chapter-2', newIndex: 3 },
    ]);

    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, TEST_STORY_ID),
    });
    expect(story?.version).toBe(1);
    const rows = await database.db.select().from(schema.chapters).all();
    const versionOf = (id: string) => rows.find((row) => row.id === id)?.version;
    expect([versionOf('chapter-1'), versionOf('chapter-2'), versionOf('chapter-3')]).toEqual([
      1, 1, 2,
    ]);
  });

  /**
   * A list gone stale (a chapter deleted or added meanwhile) still lands: unknown ids are ignored
   * and the chapters it leaves out keep their order after the ones it names.
   */
  it('lands an order built from a stale list on the chapters that are there', async () => {
    await chapterService().reorderChapters(TEST_USER_ID, TEST_STORY_ID, [
      { id: 'ghost', newIndex: 1 },
      { id: 'chapter-3', newIndex: 2 },
    ]);

    expect(await indexesInOrder()).toEqual(['chapter-3:1', 'chapter-1:2', 'chapter-2:3']);
  });
});

/**
 * Events share this table with chapters and keep an index space of their own.
 *
 * The two indices mean different things - a chapter's is the order the story is *told* in, an
 * event's is only the order the writer arranged the list in - so they are numbered independently and
 * the server validates each 1..N on its own. Everything here is about that separation holding at
 * every seam: reads, reorders, and the operation the reorder writes.
 */
describe('events and chapters as separate spaces', () => {
  beforeEach(async () => {
    await seedChapter('chapter-1', 1);
    await seedChapter('chapter-2', 2);
    await seedChapter('event-1', 1, { name: 'The Three Hundred Year War', type: 'event' });
    await seedChapter('event-2', 2, { name: 'Twenty Years of Peace', type: 'event' });
  });

  /** Every existing caller means the narrative spine, so that is what it keeps getting. */
  it('reads chapters by default', async () => {
    const all = await chapterService().getAllByStoryId(TEST_STORY_ID);
    expect(all.map((row) => row.id)).toEqual(['chapter-1', 'chapter-2']);
  });

  it('reads events when asked for them', async () => {
    const events = await chapterService().getAllByStoryId(TEST_STORY_ID, 'event');
    expect(events.map((row) => row.id)).toEqual(['event-1', 'event-2']);
  });

  /** The drawer shows one list; `null` is the explicit "both kinds" that asks for it. */
  it('reads both kinds when the type is null', async () => {
    const both = await chapterService().getAllByStoryId(TEST_STORY_ID, null);
    expect(both).toHaveLength(4);
  });

  /**
   * The combined list is grouped, events first.
   *
   * The two kinds number independently, so chapter 1 and event 1 both exist and a flat sort by
   * index would interleave them into nonsense. Grouping makes each block read as the sequence it
   * actually is.
   */
  it('puts the events first and keeps each block in its own order', async () => {
    const both = await chapterService().getAllByStoryId(TEST_STORY_ID, null);
    expect(both.map((row) => row.id)).toEqual(['event-1', 'event-2', 'chapter-1', 'chapter-2']);
  });

  it('groups the searchable listing the same way', async () => {
    const both = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      'index',
      'asc',
      undefined,
      undefined,
      null,
    );
    expect(both.map((row) => row.id)).toEqual(['event-1', 'event-2', 'chapter-1', 'chapter-2']);
  });

  it('filters the searchable listing the same way', async () => {
    const chaptersOnly = await chapterService().getChaptersByStoryId(TEST_STORY_ID);
    const eventsOnly = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      null,
      'asc',
      undefined,
      undefined,
      'event',
    );

    expect(chaptersOnly.map((row) => row.id)).toEqual(['chapter-1', 'chapter-2']);
    expect(eventsOnly.map((row) => row.id)).toEqual(['event-1', 'event-2']);
  });

  it('gives a new container the chapter type unless told otherwise', async () => {
    const created = await chapterService().createChapter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Plain',
      index: 3,
    });
    expect(created.type).toBe('chapter');
  });

  it('creates an event when asked', async () => {
    const created = await chapterService().createChapter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'An era',
      index: 3,
      type: 'event',
    });
    expect(created.type).toBe('event');
  });

  /** The two spaces share numbers without colliding: both start at 1. */
  it('lets both kinds hold the same index', async () => {
    const chapters = await chapterService().getAllByStoryId(TEST_STORY_ID);
    const events = await chapterService().getAllByStoryId(TEST_STORY_ID, 'event');
    expect(chapters.map((row) => row.index)).toEqual([1, 2]);
    expect(events.map((row) => row.index)).toEqual([1, 2]);
  });

  it('reorders events without touching the chapters', async () => {
    await chapterService().reorderChapters(
      TEST_USER_ID,
      TEST_STORY_ID,
      [
        { id: 'event-2', newIndex: 1 },
        { id: 'event-1', newIndex: 2 },
      ],
      'event',
    );

    const chapters = await chapterService().getAllByStoryId(TEST_STORY_ID);
    const events = await chapterService().getAllByStoryId(TEST_STORY_ID, 'event');
    expect(chapters.map((row) => `${row.id}:${row.index}`)).toEqual(['chapter-1:1', 'chapter-2:2']);
    expect(events.map((row) => `${row.id}:${row.index}`)).toEqual(['event-2:1', 'event-1:2']);
  });

  /** An event's move is an edit of that event: nothing about the chapters is recorded. */
  it('records the move as an edit of the event that moved', async () => {
    await chapterService().reorderChapters(
      TEST_USER_ID,
      TEST_STORY_ID,
      [
        { id: 'event-2', newIndex: 1 },
        { id: 'event-1', newIndex: 2 },
      ],
      'event',
    );

    expect(await operations()).toEqual([
      expect.objectContaining({
        operationType: 'update',
        entityType: 'Chapter',
        entityId: 'event-2',
      }),
    ]);
  });
});

/**
 * Moving a container between the two kinds: one edit of the row - its kind and its rank among the
 * kind it joins - and both spaces number themselves from their live rows' ranks.
 */
describe('converting between chapter and event', () => {
  const typesAndIndexes = async () => {
    const rows = await database.db
      .select({
        id: schema.chapters.id,
        type: schema.chapters.type,
        index: schema.chapters.index,
      })
      .from(schema.chapters)
      .where(eq(schema.chapters.isDeleted, false))
      .all();
    return Object.fromEntries(rows.map((row) => [row.id, `${row.type}:${row.index}`]));
  };

  const operationsSince = async (before: number) => (await operations()).slice(before);

  beforeEach(async () => {
    await seedChapter('chapter-1', 1);
    await seedChapter('chapter-2', 2);
    await seedChapter('chapter-3', 3);
    await seedChapter('event-1', 1, { type: 'event' });
    await seedChapter('event-2', 2, { type: 'event' });
  });

  it('closes the gap in the space it left', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-2', 'event');

    const state = await typesAndIndexes();
    expect(state['chapter-1']).toBe('chapter:1');
    expect(state['chapter-3']).toBe('chapter:2');
  });

  /** Appending claims nothing about when it happened, which is why this direction asks nothing. */
  it('appends to the end of the event list', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-2', 'event');

    const state = await typesAndIndexes();
    expect(state['chapter-2']).toBe('event:3');
    expect(state['event-1']).toBe('event:1');
    expect(state['event-2']).toBe('event:2');
  });

  it('inserts at the position asked for, pushing the rest down', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'event-1', 'chapter', 2);

    const state = await typesAndIndexes();
    expect(state['chapter-1']).toBe('chapter:1');
    expect(state['event-1']).toBe('chapter:2');
    expect(state['chapter-2']).toBe('chapter:3');
    expect(state['chapter-3']).toBe('chapter:4');
    // And the space it left closed up.
    expect(state['event-2']).toBe('event:1');
  });

  it('inserts at the front when asked for the first slot', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'event-1', 'chapter', 1);
    expect((await typesAndIndexes())['event-1']).toBe('chapter:1');
  });

  /** Both spaces contiguous from 1 is the invariant the server enforces; neither may be left broken. */
  it('leaves both spaces contiguous from 1', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-1', 'event', 1);

    const chaptersNow = await chapterService().getAllByStoryId(TEST_STORY_ID);
    const eventsNow = await chapterService().getAllByStoryId(TEST_STORY_ID, 'event');
    expect(chaptersNow.map((row) => row.index)).toEqual([1, 2]);
    expect(eventsNow.map((row) => row.index)).toEqual([1, 2, 3]);
  });

  /** One edit of the row, carrying its kind and its rank among the kind it joins. */
  it('records the conversion as one edit of the row', async () => {
    const before = (await operations()).length;
    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-2', 'event');

    const recorded = await operationsSince(before);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      operationType: 'update',
      entityType: 'Chapter',
      entityId: 'chapter-2',
    });
    expect(Object.keys(payloadOf(recorded[0]!)).sort()).toEqual(['rank', 'type', 'version']);
    expect(payloadOf(recorded[0]!).type).toBe('event');
  });

  it('does nothing at all when it is already that kind', async () => {
    const before = (await operations()).length;
    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-1', 'chapter');

    expect((await operations()).length).toBe(before);
    expect((await typesAndIndexes())['chapter-1']).toBe('chapter:1');
  });

  it('refuses a container that is not there', async () => {
    await expect(
      chapterService().convertChapterType(TEST_USER_ID, 'ghost', 'event'),
    ).rejects.toThrow(/not found/i);
  });

  /** A slot past the end is a caller bug; landing at the end is visible and fixable, unlike a crash. */
  it('clamps a position past the end instead of throwing', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'event-1', 'chapter', 99);
    expect((await typesAndIndexes())['event-1']).toBe('chapter:4');
  });

  it('clamps a position below the first slot', async () => {
    await chapterService().convertChapterType(TEST_USER_ID, 'event-1', 'chapter', 0);
    expect((await typesAndIndexes())['event-1']).toBe('chapter:1');
  });

  it('refuses to convert anything in a read-only story', async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'server-1', myRole: 'reader' })
      .where(eq(schema.stories.id, TEST_STORY_ID));

    await expect(
      chapterService().convertChapterType(TEST_USER_ID, 'chapter-1', 'event'),
    ).rejects.toThrow();
  });

  /** Scenes belong to the container, not to its kind: converting must not disturb them. */
  it('leaves the scenes inside it alone', async () => {
    await database.db.insert(schema.locations).values({
      id: 'location-1',
      storyId: TEST_STORY_ID,
      name: 'The harbour',
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.scenes).values({
      id: 'scene-1',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-2',
      locationId: 'location-1',
      name: 'The arrival',
      index: 1,
      isStart: false,
      isFinish: false,
      ...entityBase,
      deletedAt: null,
    });

    await chapterService().convertChapterType(TEST_USER_ID, 'chapter-2', 'event');

    const scene = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-1'),
    });
    expect(scene).toMatchObject({ chapterId: 'chapter-2', index: 1, version: 1 });
  });
});

describe('reading chapters', () => {
  beforeEach(async () => {
    await seedChapter('chapter-1', 1, { name: 'The Harbour', isFavorite: true });
    await seedChapter('chapter-2', 2, { name: 'The Fall' });
    await seedChapter('chapter-3', 3, { name: 'the harbour master', isDeleted: true });
  });

  it('orders by index and leaves out the deleted', async () => {
    const all = await chapterService().getAllByStoryId(TEST_STORY_ID);
    expect(all.map((chapter) => chapter.id)).toEqual(['chapter-1', 'chapter-2']);
  });

  it('searches by name without minding case', async () => {
    const found = await chapterService().getChaptersByStoryId(TEST_STORY_ID, 'harbour');
    expect(found.map((chapter) => chapter.id)).toEqual(['chapter-1']);
  });

  it('filters by favourite in both directions', async () => {
    const favourites = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      null,
      'asc',
      'favorite',
    );
    const rest = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      null,
      'asc',
      'not-favorite',
    );

    expect(favourites.map((chapter) => chapter.id)).toEqual(['chapter-1']);
    expect(rest.map((chapter) => chapter.id)).toEqual(['chapter-2']);
  });

  it('sorts by name in the direction asked', async () => {
    const descending = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      'name',
      'desc',
    );
    expect(descending.map((chapter) => chapter.name)).toEqual(['The Harbour', 'The Fall']);
  });

  it('returns nothing for a story id that is empty', async () => {
    expect(await chapterService().getAllByStoryId('')).toEqual([]);
  });

  /**
   * A failing query returns an empty list rather than throwing.
   *
   * The screens that call this render a list; an exception here would blank a screen over a
   * transient database problem, so the service swallows it and logs. Asserted so the swallowing
   * stays deliberate - it is the kind of `catch` that gets widened by accident.
   */
  it('returns an empty list when the query itself fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      select: () => {
        throw new Error('database is closed');
      },
      query: { chapters: {} },
    } as never;

    expect(await createChapterService(broken).getAllByStoryId(TEST_STORY_ID)).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it.each(['index', 'createdAt', 'updatedAt'])('sorts by %s', async (field) => {
    const sorted = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      field,
      'desc',
    );
    expect(sorted).toHaveLength(2);
  });

  /** An unknown sort is a caller bug, not a reason to return nothing: it falls through and warns. */
  it('keeps the results when asked to sort by something that is not a column', async () => {
    const sorted = await chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      'nonsense',
      'asc',
    );
    expect(sorted).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('nonsense'));
  });
});

/**
 * Advanced search over both kinds of field.
 *
 * The built-in ones come from `entityFieldMetadata['Chapter']`; anything else is treated as a custom
 * attribute key and resolved against the EAV table. A criterion the metadata does not know and that
 * is not a custom field has to be **ignored** rather than take the query down - the `?? []` in the
 * service exists because `Chapter` was missing from that metadata entirely at one point.
 */
describe('advanced search', () => {
  const CUSTOM_FIELD_ID = 'field-mood';

  const search = (criteria: Record<string, unknown>) =>
    chapterService().getChaptersByStoryId(
      TEST_STORY_ID,
      undefined,
      null,
      'asc',
      undefined,
      criteria,
    );

  beforeEach(async () => {
    await seedChapter('chapter-1', 1, { name: 'The Harbour', summary: 'Salt and rope' });
    await seedChapter('chapter-2', 2, { name: 'The Fall', isFavorite: true });

    await database.db.insert(schema.storySchemaFields).values({
      id: CUSTOM_FIELD_ID,
      storyId: TEST_STORY_ID,
      entityType: 'Chapter',
      name: 'Mood',
      key: 'mood',
      description: null,
      type: AttributeType.TEXT,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 0,
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'value-1',
      storyId: TEST_STORY_ID,
      entityType: 'Chapter',
      entityId: 'chapter-1',
      fieldId: CUSTOM_FIELD_ID,
      value: 'brooding',
      ...entityBase,
      deletedAt: null,
    });
  });

  it('matches a text field by fragment', async () => {
    expect((await search({ summary: 'rope' })).map((chapter) => chapter.id)).toEqual(['chapter-1']);
  });

  it('matches a boolean field exactly', async () => {
    expect((await search({ isFavorite: true })).map((chapter) => chapter.id)).toEqual([
      'chapter-2',
    ]);
  });

  it('matches a custom attribute through the EAV table', async () => {
    expect((await search({ [`custom:${CUSTOM_FIELD_ID}`]: 'brood' })).map((c) => c.id)).toEqual([
      'chapter-1',
    ]);
  });

  it('ignores a criterion that names nothing at all', async () => {
    expect(await search({ notAField: 'whatever' })).toHaveLength(2);
  });

  it('ignores a criterion whose value is empty', async () => {
    expect(await search({ summary: '' })).toHaveLength(2);
  });

  it('ignores a custom attribute whose field is gone', async () => {
    expect(await search({ 'custom:field-vanished': 'anything' })).toHaveLength(2);
  });
});

/**
 * A story synchronized with a server, where this device is neither owner nor writer, refuses every
 * mutation. The guard fails closed: an unresolved role is not treated as permission.
 */
describe('a read-only story', () => {
  beforeEach(async () => {
    await seedChapter('chapter-1', 1);
    await database.db
      .update(schema.stories)
      .set({ serverId: 'server-1', myRole: 'reader' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
  });

  it('refuses to create', async () => {
    await expect(
      chapterService().createChapter(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        name: 'Nope',
        index: 2,
      }),
    ).rejects.toThrow();
  });

  it('refuses to update', async () => {
    await expect(
      chapterService().updateChapter(TEST_USER_ID, 'chapter-1', { name: 'Nope' }),
    ).rejects.toThrow();
  });

  it('refuses to delete', async () => {
    await expect(chapterService().deleteChapter(TEST_USER_ID, 'chapter-1')).rejects.toThrow();
  });

  it('refuses to reorder', async () => {
    await expect(
      chapterService().reorderChapters(TEST_USER_ID, TEST_STORY_ID, [
        { id: 'chapter-1', newIndex: 1 },
      ]),
    ).rejects.toThrow();
  });

  it('still reads', async () => {
    expect(await chapterService().getAllByStoryId(TEST_STORY_ID)).toHaveLength(1);
  });
});
