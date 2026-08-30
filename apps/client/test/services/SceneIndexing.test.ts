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

const seedChapter = (id: string, index: number) =>
  database.db.insert(schema.chapters).values({
    id,
    storyId: TEST_STORY_ID,
    name: `Capítulo ${index}`,
    index,
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

  it('records the re-indexing as its own operations, so the server learns the new order', async () => {
    const service = createSceneService(database.db);
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);
    await seedScene('c', 'chapter-1', 3);

    await service.deleteScene(TEST_USER_ID, 'a');

    const logged = (await database.db.query.operationLogs.findMany()).filter(
      (operation) => operation.entityType === 'Scene' && operation.operationType === 'update',
    );
    expect(logged.map((operation) => operation.entityId).sort()).toEqual(['b', 'c']);
  });
});

describe('StoryIndexService', () => {
  it('reports a gap, a duplicate and a numbering that does not start at 1', async () => {
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 3);
    await seedScene('c', 'chapter-2', 0);
    await seedScene('d', 'chapter-2', 0);

    const problems = await createStoryIndexService(database.db).findIndexProblems(TEST_STORY_ID);

    expect(problems).toEqual([
      { scope: 'scenes', kind: 'gap', chapterId: 'chapter-1', chapterName: 'Capítulo 1' },
      { scope: 'scenes', kind: 'duplicate', chapterId: 'chapter-2', chapterName: 'Capítulo 2' },
    ]);
  });

  it('reports chapters that do not start at 1', async () => {
    await database.db
      .update(schema.chapters)
      .set({ index: 5 })
      .where(eq(schema.chapters.id, 'chapter-1'));

    const problems = await createStoryIndexService(database.db).findIndexProblems(TEST_STORY_ID);

    expect(problems).toContainEqual({ scope: 'chapters', kind: 'start' });
  });

  it('renumbers chapters and scenes to 1..N while preserving the current order', async () => {
    await database.db
      .update(schema.chapters)
      .set({ index: 7 })
      .where(eq(schema.chapters.id, 'chapter-2'));
    await seedScene('a', 'chapter-1', 4);
    await seedScene('b', 'chapter-1', 9);
    await seedScene('c', 'chapter-2', 0);

    const changed = await createStoryIndexService(database.db).normalizeIndexes(
      TEST_USER_ID,
      TEST_STORY_ID,
    );

    expect(await indexesOf('chapter-1')).toEqual(['a:1', 'b:2']);
    expect(await indexesOf('chapter-2')).toEqual(['c:1']);
    expect(
      (await database.db.query.chapters.findMany())
        .sort((first, second) => first.index - second.index)
        .map((chapter) => `${chapter.id}:${chapter.index}`),
    ).toEqual(['chapter-1:1', 'chapter-2:2']);
    expect(changed).toEqual({ chapters: 1, scenes: 3 });
    expect(await createStoryIndexService(database.db).findIndexProblems(TEST_STORY_ID)).toEqual([]);
  });

  it('leaves a story that already follows the convention untouched', async () => {
    await seedScene('a', 'chapter-1', 1);
    await seedScene('b', 'chapter-1', 2);

    const changed = await createStoryIndexService(database.db).normalizeIndexes(
      TEST_USER_ID,
      TEST_STORY_ID,
    );

    expect(changed).toEqual({ chapters: 0, scenes: 0 });
    expect(await database.db.query.operationLogs.findMany()).toHaveLength(0);
  });
});
