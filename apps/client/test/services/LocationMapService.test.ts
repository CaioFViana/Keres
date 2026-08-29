/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createLocationMapService } from '../../src/services/storymanagement/LocationMapService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createLocationMapService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

const content = {
  images: [
    { id: '01ABCDEF', galleryId: 'gallery-1', x: 0, y: 0, width: 320, height: 240, locked: false },
  ],
  nodes: [
    { id: '02GHJKMN', locationId: 'location-1', x: 100, y: 100, icon: 'pin', color: '#8BC34A' },
  ],
};

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

describe('LocationMapService', () => {
  it('stores content as an object and logs a create', async () => {
    const created = await service().createMap(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Continente',
      description: null,
      content,
    });

    expect(created.content).toEqual(content);
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'LocationMap',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation).name).toBe('Continente');
    expect(payloadOf(operation).content).toEqual(content);
  });

  it('lists only the maps of a story', async () => {
    await service().createMap(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Continente',
      description: null,
      content: { images: [], nodes: [] },
    });

    const maps = await service().getMapsForStory(TEST_STORY_ID);
    expect(maps).toHaveLength(1);
    expect(maps[0].name).toBe('Continente');
  });

  it('logs a single update when the drawing changes, and nothing when it does not', async () => {
    const created = await service().createMap(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Continente',
      description: null,
      content: { images: [], nodes: [] },
    });

    await service().updateMap(TEST_USER_ID, created.id, { content });
    const unchanged = await service().updateMap(TEST_USER_ID, created.id, { name: 'Continente' });

    expect(unchanged.content).toEqual(content);
    const updates = (await operations()).filter(
      (operation) => operation.operationType === 'update',
    );
    expect(updates).toHaveLength(1);
    expect(payloadOf(updates[0]).content).toEqual(content);
  });

  it('soft-deletes a map', async () => {
    const created = await service().createMap(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Continente',
      description: null,
      content: { images: [], nodes: [] },
    });

    await service().deleteMap(TEST_USER_ID, created.id);
    const maps = await service().getMapsForStory(TEST_STORY_ID);
    expect(maps).toHaveLength(0);
  });
});
