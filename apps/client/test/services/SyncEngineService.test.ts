/**
 * @jest-environment node
 */
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));

// A reconciliação de mídia roda no fim de cada ciclo e transfere bytes por fora do Axios;
// aqui só interessa que ela não interfira no que o ciclo de metadados fez.
const mockSyncStoryMedia = jest.fn(async () => ({ uploaded: 0, downloaded: 0, failed: 0, offline: false }));
jest.mock('../../src/services/MediaSyncService', () => ({
  createMediaSyncService: () => ({ syncStoryMedia: mockSyncStoryMedia }),
}));

import axios from 'axios';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { SyncEngineService } from '../../src/services/SyncEngineService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const SERVER = { id: 'server-1', url: 'http://servidor' };
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;
let engine: SyncEngineService;

/** Requisições vistas pelo adapter, para afirmar o que o motor mandou (e o que não mandou). */
interface SeenRequest {
  method: string;
  url: string;
  body: any;
}
let seen: SeenRequest[];

/** Resposta do pull; cada teste ajusta o que o servidor "tem". */
let pullResponse: { updates: any[]; publicFavorites?: any[]; serverMaxOperationVersion: number; role: string };
/** Resposta do push. */
let pushResponse: any;
/** Quando definido, o adapter falha como se o servidor estivesse fora do ar. */
let offlineOn: 'pull' | 'push' | null;

/**
 * O Axios resolve o adapter na hora da requisição e cai em `axios.defaults.adapter` quando a
 * instância não tem um próprio - e `createKeresAxiosInstance()` nunca define um. É isso que
 * permite interceptar o cliente privado do motor sem mockar o módulo nem abrir um seam no
 * serviço. Os interceptors dele continuam rodando normalmente.
 */
function installAdapter() {
  seen = [];
  (axios.defaults as any).adapter = async (config: any) => {
    const url = `${config.url}`;
    const method = (config.method || 'get').toUpperCase();
    seen.push({ method, url, body: config.data ? JSON.parse(config.data) : undefined });

    const isPull = url.includes('/pull');
    if ((isPull && offlineOn === 'pull') || (!isPull && method === 'POST' && offlineOn === 'push')) {
      const error: any = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.config = config;
      error.request = {};
      throw error;
    }

    const data = isPull ? pullResponse : method === 'POST' ? pushResponse : {};
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

async function seedStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'server-user',
    title: 'A Queda',
    type: 'linear',
    serverId: SERVER.id,
    myRole: 'owner',
    ...base,
    ...overrides,
  });
}

async function seedServer() {
  await database.db.insert(schema.servers).values({
    id: SERVER.id,
    idUser: 'server-user',
    userName: 'ana',
    name: 'Casa',
    url: SERVER.url,
    ...base,
  });
}

async function seedPendingOperation(overrides: Partial<typeof schema.operationLogs.$inferInsert> = {}) {
  const row = {
    id: `op-${Math.random().toString(36).slice(2)}`,
    storyId: STORY_ID,
    userId: 'server-user',
    operationVersion: 1,
    operationType: 'create' as const,
    entityType: 'Character',
    entityId: 'char-local',
    payload: JSON.stringify({ id: 'char-local', storyId: STORY_ID, name: 'Nyx', version: 1 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: 0,
    ...overrides,
  };
  await database.db.insert(schema.operationLogs).values(row);
  return row;
}

/** Operação remota de criação de personagem, na forma que o pull entrega. */
const remoteCreate = (id: string, name: string, operationVersion: number) => ({
  type: 'create',
  entity: 'Character',
  id,
  operationVersion,
  operationId: `srv-${operationVersion}`,
  data: {
    id,
    storyId: STORY_ID,
    name,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    isDeleted: false,
    deletedAt: null,
  },
});

const readStory = () => database.db.query.stories.findFirst({ where: eq(schema.stories.id, STORY_ID) });

/**
 * Um único ciclo de sincronização, sem timers. O retorno é o sinal de "servidor inalcançável"
 * que `startSync` usa para escolher entre a cadência normal e a de retentativa rápida.
 */
async function runOneCycle(): Promise<boolean> {
  return (engine as any).performSync();
}

beforeEach(async () => {
  database = await createTestDatabase();
  pullResponse = { updates: [], publicFavorites: [], serverMaxOperationVersion: 0, role: 'owner' };
  pushResponse = { message: 'ok', processedUpdates: 0, serverMaxOperationVersion: 0, applied: [], conflicts: [] };
  offlineOn = null;
  installAdapter();

  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockShowNotification.mockClear();
  mockSyncStoryMedia.mockClear();

  engine = SyncEngineService.getInstance();
  engine.setDbInstance(database.db);
  await seedServer();
  await engine.configure(STORY_ID, { ...SERVER, idUser: 'server-user' } as never);
});

afterEach(async () => {
  engine.stopSync();
  await engine.configure(undefined, null);
  delete (axios.defaults as any).adapter;
  database.close();
  jest.restoreAllMocks();
});

describe('pull', () => {
  it('asks the server only for what it has not seen yet', async () => {
    await seedStory({ lastServerSyncedLog: 7, lastPublicFavoriteLog: 3 });

    await runOneCycle();

    expect(seen[0].url).toContain('lastOperationVersion=7');
    expect(seen[0].url).toContain('lastPublicFavoriteVersion=3');
  });

  it('writes a remote creation into the local database', async () => {
    await seedStory();
    pullResponse = { updates: [remoteCreate('char-remoto', 'Keres', 5)], serverMaxOperationVersion: 5, role: 'owner' };

    await runOneCycle();

    const character = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'char-remoto'),
    });
    expect(character).toMatchObject({ name: 'Keres', storyId: STORY_ID });
  });

  /**
   * O cursor avança até a operação mais alta que realmente chegou, nunca até o
   * `serverMaxOperationVersion` da resposta: os dois são lidos em consultas separadas no
   * servidor, e uma operação gravada entre elas entra no máximo mas não na lista - confiar no
   * máximo a puliria para sempre.
   */
  it('advances the cursor only to the highest operation it actually received', async () => {
    await seedStory();
    pullResponse = { updates: [remoteCreate('char-remoto', 'Keres', 5)], serverMaxOperationVersion: 99, role: 'owner' };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(5);
  });

  it('leaves the cursor where it was when the server sent nothing', async () => {
    await seedStory({ lastServerSyncedLog: 4 });
    pullResponse = { updates: [], serverMaxOperationVersion: 42, role: 'owner' };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(4);
  });

  it('does not re-apply what it already has on a second cycle', async () => {
    await seedStory();
    pullResponse = { updates: [remoteCreate('char-remoto', 'Keres', 5)], serverMaxOperationVersion: 5, role: 'owner' };
    await runOneCycle();

    pullResponse = { updates: [], serverMaxOperationVersion: 5, role: 'owner' };
    await runOneCycle();

    const lastPull = seen.filter((request) => request.url.includes('/pull')).pop()!;
    expect(lastPull.url).toContain('lastOperationVersion=5');
  });

  it('caches the role the server reported', async () => {
    await seedStory({ myRole: 'owner' });
    pullResponse = { updates: [], serverMaxOperationVersion: 0, role: 'reader' };

    await runOneCycle();

    expect((await readStory())!.myRole).toBe('reader');
  });

  it('announces a role change, so open screens can lock editing', async () => {
    await seedStory({ myRole: 'writer' });
    pullResponse = { updates: [], serverMaxOperationVersion: 0, role: 'reader' };
    const listener = jest.fn();
    entityEventEmitter.on('story_role_changed', listener);

    await runOneCycle();
    entityEventEmitter.off('story_role_changed', listener);

    expect(listener).toHaveBeenCalledWith(STORY_ID);
  });

  it('stays quiet when the role did not change', async () => {
    await seedStory({ myRole: 'owner' });
    const listener = jest.fn();
    entityEventEmitter.on('story_role_changed', listener);

    await runOneCycle();
    entityEventEmitter.off('story_role_changed', listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it('records when the server was last reached', async () => {
    await seedStory();

    await runOneCycle();

    const server = await database.db.query.servers.findFirst({ where: eq(schema.servers.id, SERVER.id) });
    expect(server!.lastSyncDate).toBeInstanceOf(Date);
  });
});

describe('push', () => {
  it('sends the operations that were never synced', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();

    await runOneCycle();

    const push = seen.find((request) => request.method === 'POST');
    expect(push).toBeDefined();
    expect(push!.body).toHaveLength(1);
    expect(push!.body[0]).toMatchObject({ type: 'create', entity: 'Character', id: 'char-local' });
  });

  it('does not push when there is nothing pending', async () => {
    await seedStory();

    await runOneCycle();

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('does not push an operation that was already synced', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation({ isSynced: true });

    await runOneCycle();

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  /**
   * Uma operação em conflito fica fora do push até o usuário decidir. Sem isso ela seria
   * reenviada e recusada em todo ciclo, para sempre.
   */
  it.each(['conflicted', 'abandoned'] as const)('does not push an operation marked %s', async (conflictState) => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation({ conflictState });

    await runOneCycle();

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('marks an accepted operation as synced, so it is never sent twice', async () => {
    await seedStory({ lastOperationLog: 1 });
    const operation = await seedPendingOperation();
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 10,
      applied: [
        {
          clientOperationId: operation.id,
          operationVersion: 10,
          entityVersion: 1,
          entity: 'Character',
          entityId: 'char-local',
        },
      ],
      conflicts: [],
    };

    await runOneCycle();

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.isSynced).toBe(true);
  });

  it('keeps an operation pending when the server was unreachable', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    offlineOn = 'push';

    await runOneCycle();

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.isSynced).toBe(false);
  });

  it('reports being offline, so the caller retries sooner', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    offlineOn = 'push';

    await expect(runOneCycle()).resolves.toBe(true);
  });
});

describe('when the server cannot be reached', () => {
  it('does not move the cursor', async () => {
    await seedStory({ lastServerSyncedLog: 4 });
    offlineOn = 'pull';

    await runOneCycle().catch(() => {});

    expect((await readStory())!.lastServerSyncedLog).toBe(4);
  });

  it('does not bother the user with a notification', async () => {
    await seedStory();
    offlineOn = 'pull';

    await runOneCycle().catch(() => {});

    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});

describe('guards before a cycle runs', () => {
  it('does nothing without a story', async () => {
    await engine.configure(undefined, { ...SERVER, idUser: 'server-user' } as never);

    await expect(runOneCycle()).resolves.toBe(false);
    expect(seen).toEqual([]);
  });

  it('does nothing when the story is not in the local database', async () => {
    await expect(runOneCycle()).resolves.toBe(false);
    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });
});

describe('media reconciliation', () => {
  it('runs after the metadata cycle, never before', async () => {
    await seedStory();

    await runOneCycle();

    expect(mockSyncStoryMedia).toHaveBeenCalledTimes(1);
  });

  it('does not fail the cycle when media sync blows up', async () => {
    await seedStory();
    mockSyncStoryMedia.mockRejectedValueOnce(new Error('disco cheio'));

    await expect(runOneCycle()).resolves.toBe(false);
  });
});
