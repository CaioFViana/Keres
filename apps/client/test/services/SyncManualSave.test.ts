/**
 * @jest-environment node
 */
import axios from 'axios';
import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';
import { createAppSyncEngine } from '@/src/services/sync/appSyncEngine';
import type { SyncEngineService } from '@/src/services/sync/SyncEngineService';
import { createStoryService } from '@/src/services/storymanagement/story-lifecycle/StoryService';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import { createTestDatabase, type TestDatabase } from '@/test/helpers/testDb';

const mockShowNotification = jest.fn();
jest.mock('@/src/state/ui/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));
jest.mock('@/src/services/media/MediaSyncService', () => ({
  createMediaSyncService: () => ({
    syncStoryMedia: async () => ({ uploaded: 0, downloaded: 0, failed: 0, offline: false }),
  }),
}));

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER_ID = 'server-user';
const SERVER = { id: 'server-1', url: 'http://192.168.0.10' };
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;
let engine: SyncEngineService;
/** Every request the engine sent, in order. */
let seen: { method: string; url: string; body: any }[];
/** What the server answers to a push, as a function of the body it received. */
let answerPush: (body: any[]) => any;

/**
 * Stands in for the server at the HTTP adapter. Pulls are always empty (the server has nothing new); a push
 * is answered by `answerPush`.
 */
function installAdapter() {
  (axios.defaults as any).adapter = async (config: any) => {
    const url = `${config.url}`;
    const method = (config.method || 'get').toUpperCase();
    const body = config.data ? JSON.parse(config.data) : undefined;
    seen.push({ method, url, body });
    const isPull = url.includes('/pull');
    const data = isPull
      ? { updates: [], publicFavorites: [], serverMaxOperationVersion: 0, role: 'owner' }
      : answerPush(body);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

/** The server accepts every operation, as an owner's push does. */
function acceptAll(body: any[]) {
  return {
    message: 'ok',
    processedUpdates: body.length,
    serverMaxOperationVersion: 1,
    applied: body.map((update, index) => ({
      clientOperationId: update.clientOperationId,
      operationVersion: index + 1,
      entity: update.entity,
      entityId: update.id,
      entityVersion: 2,
    })),
    conflicts: [],
  };
}

/** The server refuses the change, as it does for a flag it cannot grant (adults-only with no age verification). */
function refuseAll(body: any[]) {
  return {
    message: 'ok',
    processedUpdates: body.length,
    serverMaxOperationVersion: 0,
    applied: [],
    conflicts: body.map((update) => ({
      clientOperationId: update.clientOperationId,
      entity: update.entity,
      entityId: update.id,
      type: update.type,
      reason: 'unauthorized',
      message: 'This server has no age verification, so it has no adults-only area.',
    })),
  };
}

const pushes = () => seen.filter((request) => request.method === 'POST');

beforeEach(async () => {
  database = await createTestDatabase();
  seen = [];
  answerPush = acceptAll;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  installAdapter();

  await database.db.insert(schema.servers).values({
    id: SERVER.id,
    idUser: USER_ID,
    userName: 'ana',
    name: 'Casa',
    url: SERVER.url,
    ...base,
  });
  // A story already on the server: linked, owned, and nothing new to pull.
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: USER_ID,
    title: 'A Queda',
    type: 'linear',
    serverId: SERVER.id,
    myRole: 'owner',
    isNsfw: false,
    ...base,
  });

  engine = createAppSyncEngine();
  await engine.bindDatabase(database.db);
  await engine.activateStory(STORY_ID, { ...SERVER, idUser: USER_ID } as never);
});

afterEach(async () => {
  await engine.deactivateStory();
  delete (axios.defaults as any).adapter;
  database.close();
  jest.restoreAllMocks();
});

/** What the person does on the settings screen: the same service call the save hook makes. */
const flagAdultsOnly = () =>
  createStoryService(database.db).updateStory(USER_ID, STORY_ID, { isNsfw: true });

const retitle = (title: string) =>
  createStoryService(database.db).updateStory(USER_ID, STORY_ID, { title });

const readStory = () =>
  database.db.query.stories.findFirst({ where: eq(schema.stories.id, STORY_ID) });

describe('a manual save of a linked story reaches the server', () => {
  it('pushes the changed flag and reports nothing refused when the server takes it', async () => {
    await flagAdultsOnly();

    const report = await engine.syncStoryNow(STORY_ID);

    expect(pushes()).toHaveLength(1);
    expect(pushes()[0].body).toEqual([
      expect.objectContaining({
        type: 'update',
        entity: 'Story',
        id: STORY_ID,
        changes: expect.objectContaining({ isNsfw: true }),
      }),
    ]);
    expect(report).toEqual({ conflicts: 0, refusals: [] });
  });

  it('pushes the save when the local write already started a cycle (operation_log_updated -> requestSync)', async () => {
    // The app wires the local write to a sync request, so the cycle that carries the save may be running already.
    const onLocalWrite = (storyId: string) => {
      if (storyId === STORY_ID) engine.requestSync('local-change');
    };
    entityEventEmitter.on('operation_log_updated', onLocalWrite);
    try {
      await flagAdultsOnly();
      const report = await engine.syncStoryNow(STORY_ID);

      expect(pushes()).toHaveLength(1);
      expect(report).toEqual({ conflicts: 0, refusals: [] });
    } finally {
      entityEventEmitter.off('operation_log_updated', onLocalWrite);
    }
  });

  it('reports the refused flag, and keeps the value the person set until they decide', async () => {
    answerPush = refuseAll;

    await flagAdultsOnly();
    const report = await engine.syncStoryNow(STORY_ID);

    expect(pushes()).toHaveLength(1);
    expect(report.conflicts).toBe(1);
    expect(report.refusals).toEqual([
      expect.objectContaining({ reason: 'unauthorized', entity: 'Story' }),
    ]);
    expect((await readStory())?.isNsfw).toBe(true);
  });

  it('reports a later save held behind the refused flag, instead of claiming success', async () => {
    answerPush = refuseAll;
    await flagAdultsOnly();
    await engine.syncStoryNow(STORY_ID);
    seen = [];

    // The refused change is still waiting for the person's decision, so the new save joins it and is not sent.
    await retitle('Outro');
    const report = await engine.syncStoryNow(STORY_ID);

    expect(pushes()).toHaveLength(0);
    expect(report.conflicts).toBe(1);
    expect(report.refusals).toEqual([
      expect.objectContaining({ reason: 'unauthorized', entity: 'Story' }),
    ]);
  });
});
