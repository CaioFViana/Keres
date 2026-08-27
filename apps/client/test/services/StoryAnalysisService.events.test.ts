/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryAnalysisService } from '../../src/services/storymanagement/StoryAnalysisService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * Analysis and the two index spaces.
 *
 * Chapter numbering is checked for being 1..N with no holes or repeats, and events live in the same
 * table with a 1..N of their own. Fed both, that check receives `[1, 2, 3, 1, 2]` and accuses every
 * story containing an event of corrupted numbering.
 *
 * It matters more than an ordinary false positive because it is an **integrity** finding: the
 * gentler analysis mode does not silence those, so there would be no way to make it go away short of
 * deleting the events. Same class as the export bug the testing roadmap uses as its reference case -
 * the data is right and the validation went stale.
 */

let database: TestDatabase;

const seedContainer = async (id: string, index: number, type: 'chapter' | 'event') => {
  await database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `${type} ${index}`,
    index,
    type,
    ...entityBase,
    deletedAt: null,
  });
};

const seedScene = async (id: string, chapterId: string, index: number) => {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId,
    locationId: 'location-1',
    name: id,
    index,
    isStart: false,
    isFinish: false,
    ...entityBase,
    deletedAt: null,
  });
};

const sceneFindings = async () => {
  const report = await createStoryAnalysisService(database.db).analyzeStoryCheap(TEST_STORY_ID);
  return report.findings.filter((finding) => finding.messageKey.startsWith('analysis_scene_index'));
};

const indexFindings = async () => {
  const report = await createStoryAnalysisService(database.db).analyzeStoryCheap(TEST_STORY_ID);
  return report.findings.filter((finding) =>
    finding.messageKey.startsWith('analysis_chapter_index'),
  );
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.locations).values({
    id: 'location-1',
    storyId: TEST_STORY_ID,
    name: 'The harbour',
    ...entityBase,
    deletedAt: null,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('chapter numbering with events present', () => {
  it('says nothing when each space is contiguous on its own', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('chapter-2', 2, 'chapter');
    await seedContainer('chapter-3', 3, 'chapter');
    await seedContainer('event-1', 1, 'event');
    await seedContainer('event-2', 2, 'event');

    expect(await indexFindings()).toEqual([]);
  });

  it('says nothing about a story that is nothing but events', async () => {
    await seedContainer('event-1', 1, 'event');
    await seedContainer('event-2', 2, 'event');

    expect(await indexFindings()).toEqual([]);
  });

  /** The check still does its job: broken chapter numbering is still broken. */
  it('still catches a hole in the chapter numbering', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('chapter-3', 3, 'chapter');
    await seedContainer('event-1', 1, 'event');

    expect(await indexFindings()).not.toEqual([]);
  });

  /** An event cannot make the chapters look broken, whatever number it carries. */
  it('is not confused by an event numbered beyond the last chapter', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('event-1', 9, 'event');

    expect(await indexFindings()).toEqual([]);
  });

  it('is not confused by a deleted event either', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('event-1', 1, 'event');
    await database.db
      .update(schema.chapters)
      .set({ isDeleted: true })
      .where(eq(schema.chapters.id, 'event-1'));

    expect(await indexFindings()).toEqual([]);
  });
});

/**
 * Scenes inside an event are as ordered as scenes inside a chapter.
 *
 * How the war began, the war, and what it left behind are three scenes in a sequence that means
 * something - and the API refuses a crooked reorder there for exactly the same reason it does on the
 * spine. Filtering events out of the analysis input altogether would have silently stopped checking
 * them, which is why the partition lives in the check and not in the query.
 */
describe('scene numbering inside an event', () => {
  it('is still checked', async () => {
    await seedContainer('event-1', 1, 'event');
    await seedScene('scene-a', 'event-1', 1);
    await seedScene('scene-b', 'event-1', 3);

    expect(await sceneFindings()).not.toEqual([]);
  });

  it('says nothing when it is contiguous', async () => {
    await seedContainer('event-1', 1, 'event');
    await seedScene('scene-a', 'event-1', 1);
    await seedScene('scene-b', 'event-1', 2);
    await seedScene('scene-c', 'event-1', 3);

    expect(await sceneFindings()).toEqual([]);
  });

  it('is checked separately from a chapter in the same story', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('event-1', 1, 'event');
    await seedScene('scene-a', 'chapter-1', 1);
    await seedScene('scene-b', 'event-1', 1);

    expect(await sceneFindings()).toEqual([]);
  });
});

/**
 * Branching stories are left alone entirely.
 *
 * There the scenes connect through choices, so an index is not the reading order and a hole in it
 * means nothing. The numbering check already skips those stories; this holds that in place now that
 * events pass through the same code, since an event containing choice-connected scenes is exactly
 * the case where a well-meaning special case would start inventing findings.
 */
describe('a branching story', () => {
  beforeEach(async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'branching' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
  });

  it('says nothing about chapter numbering', async () => {
    await seedContainer('chapter-1', 1, 'chapter');
    await seedContainer('chapter-3', 3, 'chapter');

    expect(await indexFindings()).toEqual([]);
  });

  it('says nothing about the scenes inside an event either', async () => {
    await seedContainer('event-1', 1, 'event');
    await seedScene('scene-a', 'event-1', 1);
    await seedScene('scene-b', 'event-1', 3);

    expect(await sceneFindings()).toEqual([]);
  });
});
