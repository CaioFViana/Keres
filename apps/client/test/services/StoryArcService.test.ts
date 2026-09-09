/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryArcService } from '../../src/services/storymanagement/StoryArcService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createStoryArcService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryArcService', () => {
  it('creates an arc and logs version 1', async () => {
    const created = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Livro I',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });

    expect(created).toMatchObject({ title: 'Livro I', version: 1, isDefault: true });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'StoryArc',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation).version).toBe(1);
  });

  it('logs the bumped version on update so push can derive OCC baseVersion', async () => {
    const created = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Livro I',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });

    const updated = await service().updateArc(TEST_USER_ID, created.id, { title: 'Livro II' });
    expect(updated).toMatchObject({ title: 'Livro II', version: 2 });

    const logged = await operations();
    const update = logged.find((entry) => entry.operationType === 'update');
    expect(update).toBeDefined();
    expect(payloadOf(update!).version).toBe(2);
  });

  it('bumps version and logs it on delete so the server accepts OCC', async () => {
    await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Default',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });
    const secondary = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Side quest',
      description: null,
      sortOrder: 1,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: false,
    });

    await service().deleteArc(TEST_USER_ID, secondary.id);

    expect(await service().getById(secondary.id)).toMatchObject({
      isDeleted: true,
      version: 2,
    });
    const logged = await operations();
    const deletion = logged.find(
      (entry) => entry.operationType === 'delete' && entry.entityId === secondary.id,
    );
    expect(deletion).toBeDefined();
    expect(payloadOf(deletion!)).toMatchObject({
      id: secondary.id,
      isDeleted: true,
      version: 2,
    });
  });
});
