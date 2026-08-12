/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { operationLogs, stories } from '../../src/db/schema';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
  StoryReadOnlyError,
} from '../../src/utils/syncUtils';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

let database: TestDatabase;

async function seedStory(overrides: Partial<typeof stories.$inferInsert> = {}) {
  const now = new Date();
  await database.db.insert(stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    ...overrides,
  });
}

const readStory = () => database.db.query.stories.findFirst({ where: eq(stories.id, STORY_ID) });

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

/**
 * O log de operações é o que o push envia; a numeração dele é o que dá ordem à sincronização.
 * Um `operationVersion` repetido ou um `lastOperationLog` que não avança corrompe o que o
 * servidor recebe, e é invisível até a próxima sincronização.
 */
describe('recordLocalOperation', () => {
  it('records the operation with everything the push needs', async () => {
    await seedStory();

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', { name: 'Keres' });

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log).toMatchObject({
      storyId: STORY_ID,
      userId: 'user-1',
      operationType: 'create',
      entityType: 'Character',
      entityId: 'char-1',
      isSynced: false,
      serverOperationVersion: 0,
    });
    expect(JSON.parse(log.payload)).toEqual({ name: 'Keres' });
  });

  it('numbers the first operation of a story as 1', async () => {
    await seedStory();

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {});

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(1);
  });

  it('numbers each operation one past the story cursor', async () => {
    await seedStory({ lastOperationLog: 7 });

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'update', 'Character', 'char-1', {});

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(8);
  });

  it('advances the story cursor, so the next operation does not reuse the number', async () => {
    await seedStory();

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {});
    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'update', 'Character', 'char-1', {});

    const logs = await database.db.query.operationLogs.findMany();
    expect(logs.map((log) => log.operationVersion).sort()).toEqual([1, 2]);
    expect((await readStory())!.lastOperationLog).toBe(2);
  });

  it('gives every operation its own id', async () => {
    await seedStory();

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {});
    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-2', {});

    const logs = await database.db.query.operationLogs.findMany();
    expect(new Set(logs.map((log) => log.id)).size).toBe(2);
  });

  it('touches the story updatedAt, so the list screens reorder', async () => {
    await seedStory({ updatedAt: new Date(0) });

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {});

    expect((await readStory())!.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it('announces the change, so an open operation log screen refreshes', async () => {
    await seedStory();
    const listener = jest.fn();
    entityEventEmitter.on('operation_log_updated', listener);

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {});
    entityEventEmitter.off('operation_log_updated', listener);

    expect(listener).toHaveBeenCalledWith(STORY_ID);
  });

  it('stores the payload as JSON that survives a round trip', async () => {
    await seedStory();
    const payload = { name: 'Keres', tags: ['a', 'b'], nested: { deep: true }, missing: null };

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'update', 'Character', 'char-1', payload);

    const [log] = await database.db.query.operationLogs.findMany();
    expect(JSON.parse(log.payload)).toEqual(payload);
  });

  it('does nothing but complain when there is no database', async () => {
    await expect(
      recordLocalOperation(null as never, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {}),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('starts numbering at 1 for a story it cannot find, rather than failing', async () => {
    await recordLocalOperation(database.db, 'nao-existe', 'user-1', 'create', 'Character', 'char-1', {});

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(1);
  });
});

/**
 * Esta guarda existe porque a escrita local é otimista: sem ela, a edição de um leitor entra
 * no banco na hora, é recusada pelo servidor em todo ciclo de sincronização daí em diante, e
 * nunca some.
 */
describe('assertStoryIsWritable', () => {
  it('allows a story that was never linked to a server', async () => {
    await seedStory({ serverId: null, myRole: null });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).resolves.toBeUndefined();
  });

  it.each(['owner', 'writer'] as const)('allows a linked story where the user is %s', async (myRole) => {
    await seedStory({ serverId: 'server-1', myRole });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).resolves.toBeUndefined();
  });

  it('refuses a linked story where the user is only a reader', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).rejects.toBeInstanceOf(StoryReadOnlyError);
  });

  it('fails closed while the role has not resolved yet', async () => {
    await seedStory({ serverId: 'server-1', myRole: null });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).rejects.toBeInstanceOf(StoryReadOnlyError);
  });

  it('allows a story it cannot find, since there is nothing to protect', async () => {
    await expect(assertStoryIsWritable(database.db, 'nao-existe')).resolves.toBeUndefined();
  });
});

describe('getUserIdForOperation', () => {
  const serverService = (idUser: string | null) =>
    ({ getServerById: jest.fn(async () => (idUser === null ? undefined : { id: 'server-1', idUser })) }) as never;

  it('uses the server account id for a synced story', async () => {
    await seedStory({ serverId: 'server-1' });

    const userId = await getUserIdForOperation(database.db, serverService('server-user'), STORY_ID, 'local-user');

    expect(userId).toBe('server-user');
  });

  it('falls back to the local id for a story that was never synced', async () => {
    await seedStory({ serverId: null });

    const userId = await getUserIdForOperation(database.db, serverService('server-user'), STORY_ID, 'local-user');

    expect(userId).toBe('local-user');
  });

  it('falls back to the local id when the server is not signed in', async () => {
    await seedStory({ serverId: 'server-1' });

    const userId = await getUserIdForOperation(database.db, serverService(null), STORY_ID, 'local-user');

    expect(userId).toBe('local-user');
  });

  it('falls back to the local id for a story it cannot find', async () => {
    const userId = await getUserIdForOperation(database.db, serverService('server-user'), 'nao-existe', 'local-user');

    expect(userId).toBe('local-user');
  });
});
