/**
 * @jest-environment node
 */
import { operationLogs, stories } from '../../src/db/schema';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService lifecycle', () => {
  it('creates a story for the caller and exposes it through live-story queries', async () => {
    const service = createStoryService(database.db);
    const created = await service.createStory('author', {
      userId: 'ignored-by-service',
      title: 'Caminhos',
      type: 'branching',
    });

    expect(created).toEqual(
      expect.objectContaining({ userId: 'author', title: 'Caminhos', type: 'branching' }),
    );
    expect(await service.getStoryById(created.id)).toEqual(
      expect.objectContaining({ id: created.id, title: 'Caminhos' }),
    );
    expect((await service.getAllStories()).map(({ id }) => id)).toEqual(
      expect.arrayContaining([TEST_STORY_ID, created.id]),
    );
    expect(
      await database.db.query.operationLogs.findFirst({
        where: (log, { eq }) => eq(log.entityId, created.id),
      }),
    ).toEqual(expect.objectContaining({ entityType: 'Story', operationType: 'create' }));
  });

  it('persists meaningful updates once and skips an unchanged save', async () => {
    const service = createStoryService(database.db);
    await service.updateStory('local-user', TEST_STORY_ID, { title: 'A Queda Final' });
    const logCountAfterChange = await database.db
      .select({ count: operationLogs.id })
      .from(operationLogs)
      .all();
    await service.updateStory('local-user', TEST_STORY_ID, { title: 'A Queda Final' });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ title: 'A Queda Final', version: 2 }),
    );
    expect(await database.db.select({ count: operationLogs.id }).from(operationLogs).all()).toEqual(
      logCountAfterChange,
    );
  });

  it('exports a complete, valid empty story package', async () => {
    const service = createStoryService(database.db);
    const exportedStoryId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    await database.db.insert(stories).values({
      id: exportedStoryId,
      userId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      title: 'Pacote válido',
      type: 'linear',
      favoriteBehavior: 'individual',
      ...entityBase,
    });
    const exported = await service.exportFullStory(exportedStoryId);

    expect(exported).toEqual(
      expect.objectContaining({
        story: expect.objectContaining({ id: exportedStoryId }),
        chapters: [],
        scenes: [],
        choices: [],
      }),
    );
  });
});
