/**
 * @jest-environment node
 */
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));

jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: jest.fn(),
}));

jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(),
}));

jest.mock('../../src/services/storymanagement/FavoriteService', () => ({
  __esModule: true,
  createFavoriteService: jest.fn(),
}));

jest.mock('../../src/services/storymanagement/CommentService', () => ({
  __esModule: true,
  createCommentService: jest.fn(),
}));

jest.mock('../../src/services/MediaSyncService', () => ({
  __esModule: true,
  createMediaSyncService: () => ({
    syncStoryMedia: jest.fn(async () => ({
      uploaded: 0,
      downloaded: 0,
      failed: 0,
      offline: false,
    })),
  }),
}));

import axios from 'axios';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { createFavoriteService } from '../../src/services/storymanagement/FavoriteService';
import { createServerService } from '../../src/services/ServerService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { SyncEngineService } from '../../src/services/SyncEngineService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
/** Forma completa de `ServerSelect`, para os testes chamarem a API real sem cast. */
const SERVER = {
  id: 'server-1',
  name: 'Casa',
  url: 'http://servidor',
  idUser: 'server-user',
  userName: 'ana',
  tag: 'ana',
  lastSyncDate: null,
  createdAt: new Date('2026-08-10T12:00:00.000Z'),
  updatedAt: new Date('2026-08-10T12:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
};
const LOCAL_USER = 'local-user';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let engine: SyncEngineService;
let seen: { method: string; url: string; body: any }[];

/** Respostas roteirizadas por trecho de URL; `null` faz a chamada falhar. */
let routes: Record<string, unknown | null>;

const mockStoryService = {
  getStoryById: jest.fn(async () => ({ id: STORY_ID, lastOperationLog: 4 }) as any),
  exportFullStory: jest.fn(async () => ({ story: { id: STORY_ID }, formatVersion: 3 })),
  importFullStory: jest.fn(async () => undefined),
  updateStory: jest.fn(async () => undefined),
};
const mockServerService = { getServerById: jest.fn(async () => SERVER as any) };
const mockFavoriteService = { migrateUserIdentity: jest.fn(async () => undefined) };
const mockCommentService = { migrateAuthorIdentity: jest.fn(async () => undefined) };

function installAdapter() {
  seen = [];
  (axios.defaults as any).adapter = async (config: any) => {
    const url = `${config.url}`;
    seen.push({
      method: (config.method || 'get').toUpperCase(),
      url,
      body: config.data ? JSON.parse(config.data) : undefined,
    });

    const key = Object.keys(routes).find((fragment) => url.includes(fragment));
    if (key === undefined || routes[key] === null) {
      const error: any = new Error('Request failed with status code 500');
      error.config = config;
      error.request = {};
      error.response = { status: 500, data: { message: 'nope' }, config, headers: {} };
      throw error;
    }
    return { data: routes[key], status: 200, statusText: 'OK', headers: {}, config };
  };
}

async function seedLocalStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: LOCAL_USER,
    title: 'A Queda',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
    lastOperationLog: 4,
    ...overrides,
  });
}

async function seedOperation(
  id: string,
  overrides: Partial<typeof schema.operationLogs.$inferInsert> = {},
) {
  await database.db.insert(schema.operationLogs).values({
    id,
    storyId: STORY_ID,
    userId: LOCAL_USER,
    operationVersion: 1,
    operationType: 'create',
    entityType: 'Character',
    entityId: 'char-1',
    payload: '{}',
    createdAt: NOW,
    isSynced: false,
    ...overrides,
  });
}

const readOperation = (id: string) =>
  database.db.query.operationLogs.findFirst({ where: eq(schema.operationLogs.id, id) });

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  (createServerService as jest.Mock).mockReturnValue(mockServerService);
  (createStoryService as jest.Mock).mockReturnValue(mockStoryService);
  (createFavoriteService as jest.Mock).mockReturnValue(mockFavoriteService);
  (createCommentService as jest.Mock).mockReturnValue(mockCommentService);
  mockServerService.getServerById.mockResolvedValue(SERVER);
  mockStoryService.getStoryById.mockResolvedValue({ id: STORY_ID, lastOperationLog: 4 });
  mockStoryService.exportFullStory.mockResolvedValue({ story: { id: STORY_ID }, formatVersion: 3 });

  routes = {
    '/sync/pullpreviews': { message: 'ok', storyPreviews: [] },
    '/export': { story: { id: STORY_ID } },
    '/stories/import': { storyId: STORY_ID },
  };
  installAdapter();

  engine = SyncEngineService.getInstance();
  engine.setDbInstance(database.db);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  engine.stopSync();
  await engine.configure(undefined, null);
  delete (axios.defaults as any).adapter;
  database.close();
  jest.restoreAllMocks();
});

describe('downloadAndImportStory', () => {
  it('fetches the export from the right server and imports it', async () => {
    await engine.downloadAndImportStory(SERVER.id, STORY_ID, 'server-user', 'reader');

    expect(seen[0]).toMatchObject({ method: 'GET', url: `/stories/${STORY_ID}/export` });
    expect(mockStoryService.importFullStory).toHaveBeenCalledWith(
      'server-user',
      { story: { id: STORY_ID } },
      SERVER.id,
      'reader',
    );
  });

  it('tells the user it worked', async () => {
    await engine.downloadAndImportStory(SERVER.id, STORY_ID, 'server-user', 'owner');

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('downloaded and imported'),
      'success',
    );
  });

  it.each([
    ['no server id', '', STORY_ID, 'server-user'],
    ['no user id', 'server-1', STORY_ID, ''],
  ])('refuses with %s, without calling the server', async (_label, serverId, storyId, userId) => {
    await engine.downloadAndImportStory(serverId, storyId, userId, 'owner');

    expect(seen).toEqual([]);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('refuses when the server is not registered locally', async () => {
    mockServerService.getServerById.mockResolvedValue(undefined);

    await engine.downloadAndImportStory(SERVER.id, STORY_ID, 'server-user', 'owner');

    expect(seen).toEqual([]);
    expect(mockStoryService.importFullStory).not.toHaveBeenCalled();
  });

  it('reports a failed download without importing anything', async () => {
    routes['/export'] = null;

    await engine.downloadAndImportStory(SERVER.id, STORY_ID, 'server-user', 'owner');

    expect(mockStoryService.importFullStory).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Failed to download'),
      'error',
    );
  });

  it('reports a failed import without pretending it worked', async () => {
    mockStoryService.importFullStory.mockRejectedValueOnce(new Error('pacote inválido'));

    await engine.downloadAndImportStory(SERVER.id, STORY_ID, 'server-user', 'owner');

    expect(mockShowNotification).not.toHaveBeenCalledWith(expect.any(String), 'success');
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Failed to download'),
      'error',
    );
  });
});

/**
 * O envio de uma história criada offline. O id local precisa sobreviver: a partir daqui o
 * cliente segue referenciando cada entidade dela pelo id que já tinha.
 */
describe('uploadNewStoryToServer', () => {
  it('checks on the server before sending, then imports preserving the id', async () => {
    await seedLocalStory();

    const result = await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(result).toEqual({ success: true });
    expect(seen[0].url).toBe('/sync/pullpreviews');
    expect(seen[1].url).toBe(`/stories/import?storyId=${STORY_ID}`);
  });

  /**
   * A checagem é feita direto no servidor, e não por `fetchServerStoryPreviews`, que engole
   * erro de rede e devolveria `[]` - o que pareceria "não existe" mesmo estando offline.
   */
  it('refuses to send a story the server already has', async () => {
    await seedLocalStory();
    routes['/sync/pullpreviews'] = { message: 'ok', storyPreviews: [{ storyId: STORY_ID }] };

    const result = await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(result).toEqual({ success: false, reason: 'already_exists' });
    expect(seen).toHaveLength(1);
  });

  it('does not send anything when the existence check fails', async () => {
    await seedLocalStory();
    routes['/sync/pullpreviews'] = null;

    const result = await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(result).toMatchObject({ success: false, reason: 'error' });
    expect(seen).toHaveLength(1);
  });

  it('refuses a story that is not here', async () => {
    mockStoryService.getStoryById.mockResolvedValue(undefined);

    const result = await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(result).toMatchObject({ success: false, reason: 'error' });
    expect(seen.some((request) => request.url.includes('/stories/import'))).toBe(false);
  });

  it('refuses without a server URL', async () => {
    const result = await engine.uploadNewStoryToServer(STORY_ID, { id: 'x' } as never, LOCAL_USER);

    expect(result).toMatchObject({ success: false, reason: 'error' });
    expect(seen).toEqual([]);
  });

  it('links the story to the server and rebases the sync cursor on what it just sent', async () => {
    await seedLocalStory({ lastOperationLog: 4 });

    await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(mockStoryService.updateStory).toHaveBeenCalledWith(LOCAL_USER, STORY_ID, {
      serverId: SERVER.id,
      lastServerSyncedLog: 4,
      lastPublicFavoriteLog: 0,
      myRole: 'owner',
    });
  });

  it('moves the local identity of favourites and comments to the server account', async () => {
    await seedLocalStory();

    await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(mockFavoriteService.migrateUserIdentity).toHaveBeenCalledWith(
      STORY_ID,
      LOCAL_USER,
      'server-user',
    );
    expect(mockCommentService.migrateAuthorIdentity).toHaveBeenCalledWith(
      STORY_ID,
      LOCAL_USER,
      'server-user',
    );
  });

  /**
   * Favoritos e comentários já vão dentro do pacote importado. Reenviá-los carregaria a
   * identidade local, que não existe no servidor, e duplicaria o comentário.
   */
  it('marks the favourite and comment operations as already sent', async () => {
    await seedLocalStory({ lastOperationLog: 4 });
    await seedOperation('op-favorite', { entityType: 'Favorite', operationVersion: 2 });
    await seedOperation('op-comment', { entityType: 'Comment', operationVersion: 3 });
    await seedOperation('op-character', { entityType: 'Character', operationVersion: 4 });

    await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect((await readOperation('op-favorite'))!.isSynced).toBe(true);
    expect((await readOperation('op-comment'))!.isSynced).toBe(true);
  });

  it('leaves the other entities to be pushed normally', async () => {
    await seedLocalStory({ lastOperationLog: 4 });
    await seedOperation('op-character', { entityType: 'Character', operationVersion: 4 });

    await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect((await readOperation('op-character'))!.isSynced).toBe(false);
  });

  it('does not touch operations newer than the snapshot it sent', async () => {
    await seedLocalStory({ lastOperationLog: 4 });
    await seedOperation('op-depois', { entityType: 'Favorite', operationVersion: 9 });

    await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect((await readOperation('op-depois'))!.isSynced).toBe(false);
  });

  it('does not link the story when the upload itself fails', async () => {
    await seedLocalStory();
    routes['/stories/import'] = null;

    const result = await engine.uploadNewStoryToServer(STORY_ID, SERVER, LOCAL_USER);

    expect(result).toMatchObject({ success: false, reason: 'error' });
    expect(mockStoryService.updateStory).not.toHaveBeenCalled();
  });
});
