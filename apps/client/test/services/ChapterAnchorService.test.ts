/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createChapterAnchorService } from '../../src/services/storymanagement/ChapterAnchorService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * Where a container sits on the story's timeline.
 *
 * Two things are worth pinning down. The first is `order`: a container that pauses and resumes has
 * more than one row, the pair `(story, container, order)` is unique, and `nextOrderFor` is the only
 * thing standing between a second stretch and a collision.
 *
 * The second is the operation log. Every mutation writes one, and a mutation that logs the wrong
 * entity or payload fails silently - the local row looks right and the other device never learns
 * about it.
 */

let database: TestDatabase;

const service = () => createChapterAnchorService(database.db);

const CHAPTER = 'chapter-1';
const EVENT = 'event-1';

const seedContainer = async (id: string, index: number, type: 'chapter' | 'event') => {
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

const seedScene = async (id: string, index: number, chapterId = CHAPTER) => {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId,
    name: id,
    index,
    ...entityBase,
    deletedAt: null,
  } as never);
};

const anchorValues = (overrides = {}) => ({
  storyId: TEST_STORY_ID,
  chapterId: EVENT,
  order: 1,
  startSceneId: 'scene-a',
  startPosition: 'start' as const,
  startOffset: null,
  startOffsetUnit: null,
  endSceneId: 'scene-b',
  endPosition: 'end' as const,
  endOffset: null,
  endOffsetUnit: null,
  ...overrides,
});

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

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedContainer(CHAPTER, 1, 'chapter');
  await seedContainer(EVENT, 1, 'event');
  await seedScene('scene-a', 1);
  await seedScene('scene-b', 2);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('creating an anchor', () => {
  it('stores it and logs a create for the ChapterAnchor entity', async () => {
    const created = await service().createAnchor(TEST_USER_ID, anchorValues());

    expect(created).toMatchObject({
      chapterId: EVENT,
      order: 1,
      startSceneId: 'scene-a',
      endSceneId: 'scene-b',
      version: 1,
      isDeleted: false,
    });

    const operation = await lastOperation();
    expect(operation).toMatchObject({
      entityType: 'ChapterAnchor',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation)).toMatchObject({ chapterId: EVENT, startSceneId: 'scene-a' });
  });

  it('stores an open stretch with no end, so the container can last as long as its scenes', async () => {
    const created = await service().createAnchor(
      TEST_USER_ID,
      anchorValues({ endSceneId: null, endPosition: null }),
    );

    expect(created.endSceneId).toBeNull();
    expect(created.endPosition).toBeNull();
  });

  it('refuses a second stretch while one is still open', async () => {
    await service().createAnchor(
      TEST_USER_ID,
      anchorValues({ endSceneId: null, endPosition: null }),
    );

    await expect(service().createAnchor(TEST_USER_ID, anchorValues({ order: 2 }))).rejects.toThrow(
      'open stretch',
    );
  });

  it('refuses to open a stretch on a container that already has another', async () => {
    await service().createAnchor(TEST_USER_ID, anchorValues({ order: 1 }));

    await expect(
      service().createAnchor(
        TEST_USER_ID,
        anchorValues({ order: 2, endSceneId: null, endPosition: null }),
      ),
    ).rejects.toThrow('only stretch');
  });

  it("keeps a ghost anchor's negative offset, which is what makes it before", async () => {
    const created = await service().createAnchor(
      TEST_USER_ID,
      anchorValues({ startOffset: -300, startOffsetUnit: 'years' }),
    );

    expect(created.startOffset).toBe(-300);
    expect(created.startOffsetUnit).toBe('years');
  });
});

describe('numbering the stretches', () => {
  it('starts at one for a container with nothing stated yet', async () => {
    expect(await service().nextOrderFor(TEST_STORY_ID, EVENT)).toBe(1);
  });

  it('hands out the next free number so a second stretch does not collide', async () => {
    await service().createAnchor(TEST_USER_ID, anchorValues({ order: 1 }));
    const next = await service().nextOrderFor(TEST_STORY_ID, EVENT);
    await service().createAnchor(TEST_USER_ID, anchorValues({ order: next }));

    expect(next).toBe(2);
    expect(await service().getAnchorsForChapter(EVENT)).toHaveLength(2);
  });

  it("ignores a deleted stretch's number, since the row no longer occupies it", async () => {
    const first = await service().createAnchor(TEST_USER_ID, anchorValues({ order: 1 }));
    await service().deleteAnchor(TEST_USER_ID, first.id);

    expect(await service().nextOrderFor(TEST_STORY_ID, EVENT)).toBe(1);
  });

  it('counts each container separately', async () => {
    await service().createAnchor(TEST_USER_ID, anchorValues({ chapterId: EVENT }));

    expect(await service().nextOrderFor(TEST_STORY_ID, CHAPTER)).toBe(1);
  });
});

describe('reading anchors back', () => {
  it("returns a story's anchors ordered by container and stretch", async () => {
    await service().createAnchor(TEST_USER_ID, anchorValues({ chapterId: EVENT, order: 2 }));
    await service().createAnchor(TEST_USER_ID, anchorValues({ chapterId: EVENT, order: 1 }));
    await service().createAnchor(TEST_USER_ID, anchorValues({ chapterId: CHAPTER, order: 1 }));

    const rows = await service().getAnchorsForStory(TEST_STORY_ID);
    expect(rows).toHaveLength(3);
    const forEvent = rows.filter((row) => row.chapterId === EVENT).map((row) => row.order);
    expect(forEvent).toEqual([1, 2]);
  });

  it('leaves out deleted anchors', async () => {
    const anchor = await service().createAnchor(TEST_USER_ID, anchorValues());
    await service().deleteAnchor(TEST_USER_ID, anchor.id);

    expect(await service().getAnchorsForStory(TEST_STORY_ID)).toEqual([]);
    expect(await service().getAnchorsForChapter(EVENT)).toEqual([]);
  });
});

describe('updating an anchor', () => {
  it('bumps the version and logs only what changed', async () => {
    const anchor = await service().createAnchor(TEST_USER_ID, anchorValues());

    const updated = await service().updateAnchor(TEST_USER_ID, anchor.id, {
      startPosition: 'middle',
    });

    expect(updated).toMatchObject({ startPosition: 'middle', version: 2 });
    const operation = await lastOperation();
    expect(operation).toMatchObject({ entityType: 'ChapterAnchor', operationType: 'update' });
    expect(payloadOf(operation)).toMatchObject({ startPosition: 'middle' });
    expect(payloadOf(operation).endSceneId).toBeUndefined();
  });

  it('writes nothing when the values are the ones already stored', async () => {
    const anchor = await service().createAnchor(TEST_USER_ID, anchorValues());
    const before = (await operations()).length;

    const unchanged = await service().updateAnchor(TEST_USER_ID, anchor.id, {
      startPosition: 'start',
    });

    expect(unchanged.version).toBe(1);
    expect((await operations()).length).toBe(before);
  });

  it('refuses an anchor that is not there', async () => {
    await expect(service().updateAnchor(TEST_USER_ID, 'missing', {})).rejects.toThrow('not found');
  });
});

describe('deleting an anchor', () => {
  it('marks it deleted and logs the delete', async () => {
    const anchor = await service().createAnchor(TEST_USER_ID, anchorValues());

    await service().deleteAnchor(TEST_USER_ID, anchor.id);

    const stored = await database.db.query.chapterAnchors.findFirst({
      where: eq(schema.chapterAnchors.id, anchor.id),
    });
    expect(stored).toMatchObject({ isDeleted: true, version: 2 });
    const operation = await lastOperation();
    expect(operation).toMatchObject({ entityType: 'ChapterAnchor', operationType: 'delete' });
    expect(payloadOf(operation)).toMatchObject({ isDeleted: true });
  });

  it('does nothing, and logs nothing, for an anchor that is not there', async () => {
    const before = (await operations()).length;

    await service().deleteAnchor(TEST_USER_ID, 'missing');

    expect((await operations()).length).toBe(before);
  });
});
