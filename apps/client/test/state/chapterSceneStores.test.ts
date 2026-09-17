/** @jest-environment node */
import * as schema from '../../src/db/schema';
import { resetAllClientStores } from '../../src/state/resetAllClientStores';
import { useChapterStore } from '../../src/state/chapterStore';
import { useSceneStore } from '../../src/state/sceneStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The chapter and scene stores' structural actions: reorder and type conversion.
 *
 * The shared list behavior (fetch, search, favorite) belongs to the factory suite
 * (`createEntityStore.test.ts`) - it runs the same code for all seventeen entity stores. What is
 * specific here is the order write: the store calls the service, announces the change, and
 * refetches so the list shows the new indexes and versions. The guards matter because the stores
 * are singletons that outlive the database handle: after an account change they hold no service
 * at all, and a reorder tap in that window must warn instead of throwing into the gesture.
 *
 * Conversion rethrows where reorder swallows: moving a container between kinds is a deliberate act
 * on one item, and the screen has to be able to tell the writer it did not happen.
 */

let database: TestDatabase;

const seedChapter = async (id: string, index: number, type = 'chapter'): Promise<void> => {
  await database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Chapter ${id}`,
    index,
    type: type as 'chapter',
    ...entityBase,
    deletedAt: null,
  });
};

const seedScene = async (id: string, index: number): Promise<void> => {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: 'chapter-1',
    name: `Scene ${id}`,
    index,
    ...entityBase,
    deletedAt: null,
  });
};

const chapterIndexes = async (): Promise<Array<[string, number]>> =>
  (await database.db.query.chapters.findMany()).map((row) => [row.id, row.index]);

const sceneIndexes = async (): Promise<Array<[string, number]>> =>
  (await database.db.query.scenes.findMany()).map((row) => [row.id, row.index]);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  resetAllClientStores();
  useUserSettingsStore.setState({ userId: TEST_USER_ID });
  useChapterStore.getState().setDbAndStoryId(database.db, TEST_STORY_ID);
  useChapterStore.getState().initializeService();
  useSceneStore.getState().setDbAndStoryId(database.db, TEST_STORY_ID);
  useSceneStore.getState().initializeService();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetAllClientStores();
  useUserSettingsStore.setState({ userId: null });
  database.close();
  jest.restoreAllMocks();
});

describe('chapter store structure', () => {
  it('reorders chapters and refetches the list in the new order', async () => {
    await seedChapter('a', 1);
    await seedChapter('b', 2);

    await useChapterStore.getState().reorderChapters([
      { id: 'a', newIndex: 2 },
      { id: 'b', newIndex: 1 },
    ]);

    expect(await chapterIndexes()).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(useChapterStore.getState().chapters.map((row) => row.id)).toEqual(['b', 'a']);
    expect(useChapterStore.getState().error).toBeNull();
  });

  it('moves a chapter between kinds and refetches the grouped list', async () => {
    await seedChapter('a', 1);

    await useChapterStore.getState().convertChapterType('a', 'event');

    const stored = await database.db.query.chapters.findFirst({
      where: (table, { eq }) => eq(table.id, 'a'),
    });
    expect(stored?.type).toBe('event');
    expect(useChapterStore.getState().chapters.map((row) => row.id)).toEqual(['a']);
  });

  it('warns instead of writing when the store was reset or the user is unknown', async () => {
    resetAllClientStores();
    await useChapterStore.getState().reorderChapters([{ id: 'a', newIndex: 1 }]);
    await useChapterStore.getState().convertChapterType('a', 'event');
    expect(console.warn).toHaveBeenCalledWith(
      'Chapter service or storyId not initialized for reordering.',
    );
    expect(console.warn).toHaveBeenCalledWith(
      'Chapter service or storyId not initialized for conversion.',
    );

    useChapterStore.getState().setDbAndStoryId(database.db, TEST_STORY_ID);
    useChapterStore.getState().initializeService();
    useUserSettingsStore.setState({ userId: null });
    await useChapterStore.getState().reorderChapters([{ id: 'a', newIndex: 1 }]);
    await useChapterStore.getState().convertChapterType('a', 'event');
    expect(console.error).toHaveBeenCalledWith('User ID not available. Cannot reorder chapters.');
    expect(console.error).toHaveBeenCalledWith('User ID not available. Cannot convert a chapter.');
  });

  it('reports a failed reorder in state and rethrows a failed conversion', async () => {
    await seedChapter('a', 1);

    await useChapterStore.getState().reorderChapters([{ id: 'missing', newIndex: 1 }]);
    expect(useChapterStore.getState().error).toMatch(/not found|reorder/i);
    expect(useChapterStore.getState().loading).toBe(false);

    await expect(useChapterStore.getState().convertChapterType('missing', 'event')).rejects.toThrow(
      'not found for conversion',
    );
    expect(useChapterStore.getState().error).toMatch(/not found for conversion/);
  });
});

describe('scene store structure', () => {
  it('reorders scenes and refetches the list in the new order', async () => {
    await seedChapter('chapter-1', 1);
    await seedScene('a', 1);
    await seedScene('b', 2);

    await useSceneStore.getState().reorderScenes('chapter-1', [
      { id: 'a', newIndex: 2 },
      { id: 'b', newIndex: 1 },
    ]);

    expect(await sceneIndexes()).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(useSceneStore.getState().scenes.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('warns instead of writing when the store was reset or the user is unknown', async () => {
    resetAllClientStores();
    await useSceneStore.getState().reorderScenes('chapter-1', [{ id: 'a', newIndex: 1 }]);
    expect(console.warn).toHaveBeenCalledWith(
      'Scene service or storyId not initialized for reordering.',
    );

    useSceneStore.getState().setDbAndStoryId(database.db, TEST_STORY_ID);
    useSceneStore.getState().initializeService();
    useUserSettingsStore.setState({ userId: null });
    await useSceneStore.getState().reorderScenes('chapter-1', [{ id: 'a', newIndex: 1 }]);
    expect(console.error).toHaveBeenCalledWith('User ID not available. Cannot reorder scenes.');
  });

  it('reports a failed reorder in state instead of throwing into the gesture', async () => {
    await seedChapter('chapter-1', 1);
    await seedScene('a', 1);

    await useSceneStore.getState().reorderScenes('chapter-1', [{ id: 'missing', newIndex: 1 }]);

    expect(useSceneStore.getState().error).toMatch(/not found|reorder/i);
    expect(useSceneStore.getState().loading).toBe(false);
  });
});
