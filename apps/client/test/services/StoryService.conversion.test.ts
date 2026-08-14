/** @jest-environment node */
import { and, asc, count, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const FIRST_CHAPTER_ID = 'chapter-first';
const SECOND_CHAPTER_ID = 'chapter-second';
const FIRST_SCENE_ID = 'scene-first';
const SECOND_SCENE_ID = 'scene-second';
const THIRD_SCENE_ID = 'scene-third';
const FOURTH_SCENE_ID = 'scene-fourth';

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});

  await database.db.insert(schema.chapters).values([
    { id: FIRST_CHAPTER_ID, storyId: TEST_STORY_ID, name: 'Inicio', index: 0, ...entityBase },
    { id: SECOND_CHAPTER_ID, storyId: TEST_STORY_ID, name: 'Fim', index: 1, ...entityBase },
  ]);
  await database.db.insert(schema.scenes).values([
    {
      id: FIRST_SCENE_ID,
      storyId: TEST_STORY_ID,
      chapterId: FIRST_CHAPTER_ID,
      locationId: 'location-1',
      name: 'Abertura',
      index: 0,
      ...entityBase,
    },
    {
      id: SECOND_SCENE_ID,
      storyId: TEST_STORY_ID,
      chapterId: FIRST_CHAPTER_ID,
      locationId: 'location-1',
      name: 'Virada',
      index: 1,
      ...entityBase,
    },
    {
      id: THIRD_SCENE_ID,
      storyId: TEST_STORY_ID,
      chapterId: SECOND_CHAPTER_ID,
      locationId: 'location-2',
      name: 'Confronto',
      index: 0,
      ...entityBase,
    },
    {
      id: FOURTH_SCENE_ID,
      storyId: TEST_STORY_ID,
      chapterId: SECOND_CHAPTER_ID,
      locationId: 'location-2',
      name: 'Desfecho',
      index: 1,
      ...entityBase,
    },
  ]);
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService type conversion', () => {
  it('makes the implicit linear sequence explicit, then restores its ordering and removes choices', async () => {
    const service = createStoryService(database.db);

    await service.convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'branching');

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ type: 'branching' }),
    );
    expect(
      (
        await database.db
          .select({ sceneId: schema.choices.sceneId, nextSceneId: schema.choices.nextSceneId })
          .from(schema.choices)
          .where(eq(schema.choices.isDeleted, false))
          .orderBy(asc(schema.choices.createdAt))
          .all()
      ).sort((left, right) => left.sceneId.localeCompare(right.sceneId)),
    ).toEqual(
      [
        { sceneId: FIRST_SCENE_ID, nextSceneId: SECOND_SCENE_ID },
        { sceneId: SECOND_SCENE_ID, nextSceneId: THIRD_SCENE_ID },
        { sceneId: THIRD_SCENE_ID, nextSceneId: FOURTH_SCENE_ID },
      ].sort((left, right) => left.sceneId.localeCompare(right.sceneId)),
    );

    // better-sqlite3 transactions are synchronous, unlike expo-sqlite's awaited callback.
    (
      database.db as unknown as {
        transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
      }
    ).transaction = async (callback) => callback(database.db);

    await service.convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'linear');

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ type: 'linear' }),
    );
    expect(
      await database.db
        .select({ id: schema.choices.id, isDeleted: schema.choices.isDeleted })
        .from(schema.choices)
        .all(),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ isDeleted: true })]));
  });

  it('refuses to flatten a branching story that has a bifurcation', async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'branching' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    await database.db.insert(schema.choices).values([
      {
        id: 'choice-first-second',
        storyId: TEST_STORY_ID,
        sceneId: FIRST_SCENE_ID,
        nextSceneId: SECOND_SCENE_ID,
        text: 'Continuar',
        ...entityBase,
      },
      {
        id: 'choice-first-loop',
        storyId: TEST_STORY_ID,
        sceneId: FIRST_SCENE_ID,
        nextSceneId: FIRST_SCENE_ID,
        text: 'Pular',
        ...entityBase,
      },
    ]);

    await expect(
      createStoryService(database.db).convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'linear'),
    ).rejects.toThrow(/not compatible.*Inicio \(bifurcation\)/i);

    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ type: 'branching' }),
    );
    expect(
      await database.db
        .select({ count: count() })
        .from(schema.choices)
        .where(eq(schema.choices.isDeleted, false))
        .all(),
    ).toEqual([{ count: 2 }]);
  });

  it('restores the choice order inside a chapter even when its stored indexes are stale', async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'branching' })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    await database.db
      .update(schema.scenes)
      .set({ isDeleted: true })
      .where(eq(schema.scenes.chapterId, SECOND_CHAPTER_ID));
    await database.db
      .update(schema.scenes)
      .set({ index: 1 })
      .where(eq(schema.scenes.id, FIRST_SCENE_ID));
    await database.db
      .update(schema.scenes)
      .set({ index: 0 })
      .where(eq(schema.scenes.id, SECOND_SCENE_ID));
    await database.db.insert(schema.choices).values({
      id: 'choice-first-second',
      storyId: TEST_STORY_ID,
      sceneId: FIRST_SCENE_ID,
      nextSceneId: SECOND_SCENE_ID,
      text: 'Continuar',
      ...entityBase,
    });

    (
      database.db as unknown as {
        transaction: <T>(callback: (tx: typeof database.db) => Promise<T>) => Promise<T>;
      }
    ).transaction = async (callback) => callback(database.db);

    await createStoryService(database.db).convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'linear');

    expect(
      await database.db
        .select({ id: schema.scenes.id, index: schema.scenes.index })
        .from(schema.scenes)
        .where(
          and(eq(schema.scenes.chapterId, FIRST_CHAPTER_ID), eq(schema.scenes.isDeleted, false)),
        )
        .orderBy(asc(schema.scenes.index))
        .all(),
    ).toEqual([
      { id: FIRST_SCENE_ID, index: 0 },
      { id: SECOND_SCENE_ID, index: 1 },
    ]);
  });
});
