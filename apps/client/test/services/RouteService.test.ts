/** @jest-environment node */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createRouteService } from '../../src/services/storymanagement/RouteService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db
    .update(schema.stories)
    .set({ type: 'branching' })
    .where(eq(schema.stories.id, TEST_STORY_ID))
    .run();
  await database.db.insert(schema.locations).values({
    id: 'location',
    storyId: TEST_STORY_ID,
    name: 'Porto',
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.chapters).values({
    id: 'chapter',
    storyId: TEST_STORY_ID,
    name: 'Ato',
    index: 0,
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.scenes).values([
    {
      id: 'scene-a',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter',
      locationId: 'location',
      name: 'Começo',
      index: 0,
      isStart: true,
      isFinish: false,
      ...entityBase,
      deletedAt: null,
    },
    {
      id: 'scene-b',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter',
      locationId: 'location',
      name: 'Fim',
      index: 1,
      isStart: false,
      isFinish: true,
      ...entityBase,
      deletedAt: null,
    },
  ]);
  await database.db.insert(schema.choices).values({
    id: 'choice-a',
    storyId: TEST_STORY_ID,
    sceneId: 'scene-a',
    nextSceneId: 'scene-b',
    text: 'Seguir',
    ...entityBase,
    deletedAt: null,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('RouteService', () => {
  it('persists a validated route as ordered, syncable operations', async () => {
    const service = createRouteService(database.db);
    const route = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Caminho principal',
      details: null,
    });
    await service.replaceSteps(TEST_USER_ID, route.id, [
      { sceneId: 'scene-a', selectedChoiceId: 'choice-a' },
      { sceneId: 'scene-b', selectedChoiceId: null },
    ]);
    expect(await service.getSteps(route.id)).toMatchObject([
      { position: 1, sceneId: 'scene-a', selectedChoiceId: 'choice-a' },
      { position: 2, sceneId: 'scene-b', selectedChoiceId: null },
    ]);
    const operations = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.storyId, TEST_STORY_ID),
    });
    expect(operations.map((entry) => entry.entityType)).toEqual([
      'Route',
      'RouteStep',
      'RouteStep',
    ]);
  });

  it('rejects a choice that does not leave the step scene', async () => {
    const service = createRouteService(database.db);
    const route = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Inválida',
      details: null,
    });
    await expect(
      service.replaceSteps(TEST_USER_ID, route.id, [
        { sceneId: 'scene-b', selectedChoiceId: 'choice-a' },
        { sceneId: 'scene-b', selectedChoiceId: null },
      ]),
    ).rejects.toThrow(/choice_source_mismatch/i);
  });

  it('refuses routes in a linear story', async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'linear' })
      .where(eq(schema.stories.id, TEST_STORY_ID))
      .run();
    await expect(
      createRouteService(database.db).save(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        name: 'Não pode',
        details: null,
      }),
    ).rejects.toThrow(/branching/i);
  });
});
