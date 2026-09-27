/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { createStoryIndexService } from '../../src/services/storymanagement/StoryIndexService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const seedChapter = (id: string, index: number, type: 'chapter' | 'event' = 'chapter') =>
  database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Capítulo ${index}`,
    index,
    type,
    ...entityBase,
    deletedAt: null,
  });

const seedScene = (id: string, chapterId: string, index: number) =>
  database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId,
    locationId: 'location-1',
    name: `Cena ${id}`,
    index,
    isStart: false,
    isFinish: false,
    ...entityBase,
    deletedAt: null,
  });

const indexesOf = async (chapterId: string) =>
  (await database.db.query.scenes.findMany())
    .filter((scene) => scene.chapterId === chapterId && !scene.isDeleted)
    .sort((a, b) => a.index - b.index)
    .map((scene) => `${scene.id}:${scene.index}`);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.locations).values({
    id: 'location-1',
    storyId: TEST_STORY_ID,
    name: 'O porto',
    ...entityBase,
    deletedAt: null,
  });
  await seedChapter('chapter-1', 1);
  await seedChapter('chapter-2', 2);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('SceneService index handling', () => {
  it('assigns a new scene to the end of its chapter', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);

    const created = await service.createScene(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'Cena nova',
    });

    expect(created.index).toBe(3);
    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'b:2', `${created.id}:3`]);
  });

  it('closes the gap left in the chapter when a scene is deleted', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);

    await service.deleteScene(TEST_USER_ID, 'b');

    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'c:2']);
  });

  it('moves a scene to the end of the target chapter and closes the gap in the old one', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);
    await seedScene('d', 'chapter-2', 1);

    await service.updateScene(TEST_USER_ID, 'b', { chapterId: 'chapter-2' });

    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'c:2']);
    expect(await indexesOf('chapter-2')).toEqual(['d:1', 'b:2']);
  });

  it('gives the first scene of an empty chapter the number 1', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);

    await service.updateScene(TEST_USER_ID, 'a', { chapterId: 'chapter-2' });

    expect(await indexesOf('chapter-2')).toEqual(['a:1']);
  });

  it('lets a scene leave its chapter without numbering the unchaptered group', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);

    await service.updateScene(TEST_USER_ID, 'b', { chapterId: null });

    expect(await indexesOf('chapter-1')).toEqual(['a:1']);
    const unchaptered = (await database.db.query.scenes.findMany()).find(
      (scene) => scene.id === 'b',
    );
    expect(unchaptered?.chapterId).toBeNull();
  });

  it('quick-captures a title-only scene unchaptered and files it into a chapter later', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);

    const created = await service.createScene(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Stray thought',
    });
    expect(created.chapterId).toBeNull();

    await service.updateScene(TEST_USER_ID, created.id, { chapterId: 'chapter-1' });

    expect(await indexesOf('chapter-1')).toEqual(['a:1', `${created.id}:2`]);
  });

  it('does not try to renumber when an unchaptered scene is deleted', async () => {
    const service = createSceneService(database.db);
    await database.db.insert(schema.scenes).values({
      id: 'loose',
      storyId: TEST_STORY_ID,
      chapterId: null,
      locationId: 'location-1',
      name: 'Loose',
      index: 1,
      isStart: false,
      isFinish: false,
      ...entityBase,
      deletedAt: null,
    });

    await service.deleteScene(TEST_USER_ID, 'loose');

    const stored = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'loose'),
    });
    expect(stored?.isDeleted).toBe(true);
  });

  it('records only the deletion: the chapter closes its gap by itself', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);

    await service.deleteScene(TEST_USER_ID, 'a');

    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.map((op) => [op.operationType, op.entityType, op.entityId])).toEqual([
      ['delete', 'Scene', 'a'],
    ]);
    expect(await indexesOf('chapter-1')).toEqual(['b:1', 'c:2']);
  });

  it('keeps the scenes an order leaves out after the ones it names', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);

    await service.reorderScenes(TEST_USER_ID, TEST_STORY_ID, 'chapter-1', [
      { id: 'c', newIndex: 1 },
    ]);

    expect(await indexesOf('chapter-1')).toEqual(['c:1', 'a:2', 'b:3']);
  });

  it('edits only the scene that moved, with its new rank', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);

    await service.reorderScenes(TEST_USER_ID, TEST_STORY_ID, 'chapter-1', [
      { id: 'a', newIndex: 1 },
      { id: 'c', newIndex: 2 },
      { id: 'b', newIndex: 3 },
    ]);

    const rows = await database.db.query.scenes.findMany();
    const versionOf = (id: string) => rows.find((row) => row.id === id)?.version;
    expect([versionOf('a'), versionOf('b'), versionOf('c')]).toEqual([1, 1, 2]);
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      operationType: 'update',
      entityType: 'Scene',
      entityId: 'c',
    });
    expect(Object.keys(JSON.parse(logged[0]!.payload)).sort()).toEqual(['rank', 'version']);
    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'c:2', 'b:3']);
  });
});

describe('StoryIndexService', () => {
  it('finds nothing to fix: every number derives from the ranks', async () => {
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 3);
    await seedScene('c', 'chapter-2', 0);
    await seedScene('d', 'chapter-2', 0);

    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'b:2']);
    expect(await indexesOf('chapter-2')).toEqual(['c:1', 'd:2']);
    expect(await createStoryIndexService(database.db).findIndexProblems(TEST_STORY_ID)).toEqual([]);
  });

  it('re-derives a number a stray write bent, locally and without an operation', async () => {
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await database.db.update(schema.scenes).set({ index: 9 }).where(eq(schema.scenes.id, 'b'));
    await database.db
      .update(schema.chapters)
      .set({ index: 5 })
      .where(eq(schema.chapters.id, 'chapter-1'));
    const service = createStoryIndexService(database.db);
    expect(await service.findIndexProblems(TEST_STORY_ID)).toEqual(
      expect.arrayContaining([
        { scope: 'chapters', kind: 'start' },
        { scope: 'scenes', kind: 'gap', chapterId: 'chapter-1', chapterName: 'Capítulo 1' },
      ]),
    );

    expect(await service.normalizeIndexes(TEST_USER_ID, TEST_STORY_ID)).toEqual({
      chapters: 1,
      scenes: 1,
    });
    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'b:2']);
    expect(await service.findIndexProblems(TEST_STORY_ID)).toEqual([]);
    expect(await database.db.query.operationLogs.findMany()).toHaveLength(0);
  });

  it('keeps event numbering separate from the chapter spine', async () => {
    await seedChapter('event-1', 4, 'event');

    const rows = await database.db.query.chapters.findMany();
    expect(rows.find((chapter) => chapter.id === 'event-1')?.index).toBe(1);
    expect(rows.find((chapter) => chapter.id === 'chapter-1')?.index).toBe(1);
    expect(rows.find((chapter) => chapter.id === 'chapter-2')?.index).toBe(2);
  });
});

/**
 * A linear story has one start and one finish. Taking a flag records the loss on the scene that
 * held it, as an edit of its own: the server only touches the row an operation names, so no other
 * device would learn of it otherwise.
 */
describe('SceneService start and finish handoff', () => {
  const flagsOf = async () =>
    Object.fromEntries(
      (await database.db.query.scenes.findMany()).map((scene) => [
        scene.id,
        { isStart: scene.isStart, isFinish: scene.isFinish, version: scene.version },
      ]),
    );

  it('records the flag the previous holder loses, one version up', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await database.db.update(schema.scenes).set({ isStart: true }).where(eq(schema.scenes.id, 'a'));

    await service.updateScene(TEST_USER_ID, 'b', { isStart: true });

    expect(await flagsOf()).toEqual({
      a: { isStart: false, isFinish: false, version: 2 },
      b: { isStart: true, isFinish: false, version: 2 },
    });
    const logged = await database.db.query.operationLogs.findMany();
    const loss = logged.find((op) => op.entityId === 'a');
    expect(loss).toMatchObject({ operationType: 'update', entityType: 'Scene' });
    expect(JSON.parse(loss!.payload)).toEqual({ isStart: false, version: 2 });
  });

  it('takes the flag on create too, and leaves a deleted holder alone', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('gone', 'chapter-1', 2);
    await database.db
      .update(schema.scenes)
      .set({ isFinish: true })
      .where(eq(schema.scenes.id, 'a'));
    await database.db
      .update(schema.scenes)
      .set({ isFinish: true, isDeleted: true })
      .where(eq(schema.scenes.id, 'gone'));

    await service.createScene(TEST_USER_ID, {
      id: 'c',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'Fim',
      isFinish: true,
    } as never);

    const flags = await flagsOf();
    expect(flags.a).toEqual({ isStart: false, isFinish: false, version: 2 });
    expect(flags.gone).toMatchObject({ isFinish: true, version: 1 });
    expect(flags.c).toMatchObject({ isFinish: true });
  });

  it('lets many scenes hold a flag in a story that is not linear', async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'branching' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await database.db.update(schema.scenes).set({ isStart: true }).where(eq(schema.scenes.id, 'a'));

    await service.updateScene(TEST_USER_ID, 'b', { isStart: true });

    expect((await flagsOf()).a).toEqual({ isStart: true, isFinish: false, version: 1 });
    const logged = await database.db.query.operationLogs.findMany();
    expect(logged.some((op) => op.entityId === 'a')).toBe(false);
  });
});

/**
 * Deleting a chapter - here, or on another device while this one placed a scene in it - never
 * makes its scenes vanish: they read as unchaptered, and come back under the chapter if it is
 * restored. Nothing is written for it, so every device shows the same thing from the same rows.
 */
describe('SceneService scenes of a deleted chapter', () => {
  const deleteChapter = (isDeleted: boolean) =>
    database.db
      .update(schema.chapters)
      .set({ isDeleted })
      .where(eq(schema.chapters.id, 'chapter-1'));

  it('reads them as unchaptered while the chapter is deleted, and back once it returns', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-2', 1);
    await deleteChapter(true);

    const chapterOf = async () =>
      Object.fromEntries(
        (await service.getAllByStoryId(TEST_STORY_ID)).map((scene) => [scene.id, scene.chapterId]),
      );
    expect(await chapterOf()).toEqual({ a: null, b: 'chapter-2' });
    expect((await service.getById('a'))?.chapterId).toBeNull();
    const listed = await service.getScenesByStoryId(TEST_STORY_ID);
    expect(listed.find((scene) => scene.id === 'a')?.chapterId).toBeNull();
    expect(await service.getPreviousNextScenes(TEST_STORY_ID, 'a', null)).toEqual({
      previousScene: undefined,
      nextScene: undefined,
    });
    // The stored chapter is untouched and nothing is queued.
    expect(
      (await database.db.query.scenes.findFirst({ where: eq(schema.scenes.id, 'a') }))?.chapterId,
    ).toBe('chapter-1');
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);

    await deleteChapter(false);
    expect(await chapterOf()).toEqual({ a: 'chapter-1', b: 'chapter-2' });
  });
});
