/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createBoardService } from '../../src/services/storymanagement/BoardService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createBoardService(database.db);

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

describe('BoardService', () => {
  it('stores content as an object and logs a create', async () => {
    const created = await service().createBoard(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Royal family',
      description: 'Who sits where',
      content: { nodes: [], edges: [] },
    });

    expect(created.content).toEqual({ nodes: [], edges: [] });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'Board',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation).name).toBe('Royal family');
    expect(payloadOf(operation).content).toEqual({ nodes: [], edges: [] });
  });

  it('logs a single update when the drawing changes, and nothing when it does not', async () => {
    const created = await service().createBoard(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Royal family',
      description: null,
      content: { nodes: [], edges: [] },
    });

    await service().updateBoard(TEST_USER_ID, created.id, {
      content: {
        nodes: [
          {
            id: '01ABCDEF',
            kind: 'note',
            x: 10,
            y: 20,
            title: 'Theme',
            body: null,
          },
        ],
        edges: [],
      },
    });
    const unchanged = await service().updateBoard(TEST_USER_ID, created.id, {
      name: 'Royal family',
    });

    expect(unchanged.version).toBe(2);
    const logged = (await operations()).filter((row) => row.operationType === 'update');
    expect(logged).toHaveLength(1);
    expect(logged).toEqual([
      expect.objectContaining({
        payload: expect.stringContaining('"edges":[]'),
      }),
    ]);
    const [update] = logged;
    expect(payloadOf(update).content).toEqual({
      nodes: [
        {
          id: '01ABCDEF',
          kind: 'note',
          x: 10,
          y: 20,
          title: 'Theme',
          body: null,
        },
      ],
      edges: [],
    });
  });

  it('soft-deletes a board', async () => {
    const created = await service().createBoard(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Scratch',
      description: null,
      content: { nodes: [], edges: [] },
    });
    await service().deleteBoard(TEST_USER_ID, created.id);

    expect(await service().getBoardsForStory(TEST_STORY_ID)).toEqual([]);
    expect(await service().getById(created.id)).toMatchObject({ isDeleted: true });
  });
});
