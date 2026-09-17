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

  it('renames a route and reads it back alongside its siblings', async () => {
    const service = createRouteService(database.db);
    const first = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: '  Caminho principal  ',
      details: null,
    });
    await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Atalho',
      details: null,
    });

    const updated = await service.save(TEST_USER_ID, {
      id: first.id,
      storyId: TEST_STORY_ID,
      name: 'Caminho final',
      details: 'revised',
    });

    // The name is trimmed on the way in, so the list never shows stray whitespace.
    expect(updated).toMatchObject({ name: 'Caminho final', details: 'revised', version: 2 });
    expect(await service.getById(first.id)).toMatchObject({ name: 'Caminho final' });
    expect((await service.getAllByStoryId(TEST_STORY_ID)).map((route) => route.name)).toEqual([
      'Atalho',
      'Caminho final',
    ]);
    const operations = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.storyId, TEST_STORY_ID),
    });
    expect(
      operations.filter((entry) => entry.entityId === first.id).map((entry) => entry.operationType),
    ).toEqual(['create', 'update']);
  });

  it('refuses to update a route that does not exist', async () => {
    await expect(
      createRouteService(database.db).save(TEST_USER_ID, {
        id: 'missing',
        storyId: TEST_STORY_ID,
        name: 'Ghost',
        details: null,
      }),
    ).rejects.toThrow('Route not found.');
  });

  it('replaces the steps wholesale, tombstoning the old ones with their own operations', async () => {
    const service = createRouteService(database.db);
    const route = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Caminho',
      details: null,
    });
    await service.replaceSteps(TEST_USER_ID, route.id, [
      { sceneId: 'scene-a', selectedChoiceId: 'choice-a' },
      { sceneId: 'scene-b', selectedChoiceId: null },
    ]);
    const firstSteps = await service.getSteps(route.id);

    await service.replaceSteps(TEST_USER_ID, route.id, [
      { sceneId: 'scene-b', selectedChoiceId: null },
    ]);

    expect(await service.getSteps(route.id)).toMatchObject([
      { position: 1, sceneId: 'scene-b', selectedChoiceId: null },
    ]);
    const operations = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.storyId, TEST_STORY_ID),
    });
    const stepOperations = operations.filter((entry) => entry.entityType === 'RouteStep');
    expect(
      stepOperations
        .filter((entry) => entry.operationType === 'delete')
        .map((entry) => entry.entityId)
        .sort(),
    ).toEqual(firstSteps.map((step) => step.id).sort());
    expect(stepOperations.filter((entry) => entry.operationType === 'create')).toHaveLength(3);
  });

  it('refuses steps for a route that does not exist', async () => {
    await expect(
      createRouteService(database.db).replaceSteps(TEST_USER_ID, 'missing', [
        { sceneId: 'scene-b', selectedChoiceId: null },
      ]),
    ).rejects.toThrow('Route not found.');
  });

  it('refuses steps once the story stops being branching', async () => {
    const service = createRouteService(database.db);
    const route = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Caminho',
      details: null,
    });
    await database.db
      .update(schema.stories)
      .set({ type: 'linear' })
      .where(eq(schema.stories.id, TEST_STORY_ID))
      .run();

    await expect(
      service.replaceSteps(TEST_USER_ID, route.id, [
        { sceneId: 'scene-b', selectedChoiceId: null },
      ]),
    ).rejects.toThrow(/branching/i);
  });

  it('deletes a route with its steps, each with its own operation, and stays quiet on a second delete', async () => {
    const service = createRouteService(database.db);
    const route = await service.save(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Caminho',
      details: null,
    });
    await service.replaceSteps(TEST_USER_ID, route.id, [
      { sceneId: 'scene-a', selectedChoiceId: 'choice-a' },
      { sceneId: 'scene-b', selectedChoiceId: null },
    ]);

    await service.delete(TEST_USER_ID, route.id);

    expect(await service.getById(route.id)).toBeUndefined();
    expect(await service.getSteps(route.id)).toEqual([]);
    const operations = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.storyId, TEST_STORY_ID),
    });
    expect(
      operations
        .filter((entry) => entry.operationType === 'delete')
        .map((entry) => entry.entityType)
        .sort(),
    ).toEqual(['Route', 'RouteStep', 'RouteStep']);

    await service.delete(TEST_USER_ID, route.id);
    await service.delete(TEST_USER_ID, 'missing');
    expect(
      (await database.db.query.operationLogs.findMany()).filter(
        (entry) => entry.operationType === 'delete',
      ),
    ).toHaveLength(3);
  });
});
