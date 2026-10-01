import axios from 'axios';
import * as http from 'node:http';
import { and, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { getEntityTable } from '../../src/services/entityTableRegistry';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { createStatService } from '../../src/services/storymanagement/StatService';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { createChapterAnchorService } from '../../src/services/storymanagement/ChapterAnchorService';
import { createCharacterRelationService } from '../../src/services/storymanagement/CharacterRelationService';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { createFavoriteService } from '../../src/services/storymanagement/FavoriteService';
import { createRouteService } from '../../src/services/storymanagement/RouteService';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { createTagRelationService } from '../../src/services/storymanagement/TagRelationService';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { createSyncConflictService } from '../../src/services/SyncConflictService';
import type { SyncEngineService } from '../../src/services/SyncEngineService';
import { createAppSyncEngine } from '../../src/services/sync/appSyncEngine';
import { ReferenceSyncServer } from './referenceSyncServer';
import { createTestDatabase, type TestDatabase } from './testDb';

/**
 * Several devices sharing one story through a `ReferenceSyncServer`: each device is a real
 * `SyncEngineService` over its own SQLite database, and local edits go through the real entity
 * services, so every op-log, version and conflict path is the production one. Only the network
 * is replaced - the axios adapter routes each request to the shared server by the device's URL.
 *
 * The test files using this must mock `notificationStore` and `MediaSyncService` (see
 * `SyncConvergence.test.ts`): both reach platform APIs Jest does not have.
 */

export const STORY_ID = '01J00000000000000000STORY0';
export const SERVER_ID = 'server-1';
export const USER_ID = 'server-user';
const NOW = new Date('2026-01-01T00:00:00.000Z');

export type RequestKind = 'pull' | 'push';
export type StoryType = 'linear' | 'branching';

/** The content columns the reference server models per entity (see its constructor). */
const MODELLED_COLUMNS = {
  Character: ['name', 'title', 'description'],
  Chapter: ['name', 'index', 'rank', 'type'],
  Scene: ['name', 'index', 'rank', 'chapterId', 'isStart'],
  Stat: ['name', 'order', 'rank'],
  StorySchemaField: ['name', 'key', 'entityType', 'order', 'rank'],
  AttributeValue: ['entityType', 'entityId', 'fieldId', 'value'],
  Tag: ['name', 'color'],
  TagRelation: ['tagId', 'relationId', 'relationType'],
  CharacterRelation: ['character1Id', 'character2Id', 'relationType'],
  Favorite: ['entityId', 'entityType', 'userId'],
  Comment: ['entityType', 'entityId', 'commentText', 'authorUserId'],
  ChapterAnchor: [
    'chapterId',
    'order',
    'startSceneId',
    'startPosition',
    'endSceneId',
    'endPosition',
  ],
  Route: ['name', 'details'],
  RouteStep: ['routeId', 'position', 'sceneId', 'selectedChoiceId'],
  Location: ['name'],
  LocationRelation: ['locationAId', 'locationBId', 'relationType'],
  LocationMap: ['name'],
  Item: ['name'],
  ItemJourney: ['itemId', 'sceneId', 'newState'],
  Note: ['title'],
  NoteRelation: ['noteId', 'relationId', 'relationType'],
  WorldRule: ['title'],
  SeeAlsoRelation: ['entityAType', 'entityAId', 'entityBType', 'entityBId'],
  Suggestion: ['type', 'value'],
  Board: ['name'],
  Plot: ['name'],
  PlotScene: ['plotId', 'sceneId', 'note'],
  StoryArc: ['title', 'sortOrder'],
  StoryCalendar: ['name', 'isPrimary'],
  Gallery: ['hash', 'fileName', 'title'],
  GalleryRelation: ['galleryId', 'ownerId', 'ownerType'],
  CharacterScene: ['characterId', 'sceneId'],
  Mode: ['characterId', 'name'],
  StatRelation: ['characterId', 'modeId', 'statId', 'value'],
  StatStrength: ['statId', 'label', 'minValue'],
  Choice: ['sceneId', 'nextSceneId', 'text'],
  ChoiceCheckGroup: ['choiceId', 'combinator'],
  ChoiceCheck: ['groupId', 'type', 'triggerName', 'triggerState'],
  Effect: ['entityType', 'entityId', 'effectType', 'triggerName'],
  Story: ['title'],
} as const;

/** Every entity type the harness models, the story itself aside. */
export const MODELLED_ENTITY_TYPES = Object.keys(MODELLED_COLUMNS).filter(
  (entityType) => entityType !== 'Story',
);

export class SyncDevice {
  readonly characters;
  readonly chapters;
  readonly scenes;
  readonly stats;
  readonly fields;
  readonly attributes;
  readonly tags;
  readonly tagRelations;
  readonly characterRelations;
  readonly favorites;
  readonly comments;
  readonly anchors;
  readonly routes;
  readonly conflicts;

  constructor(
    readonly name: string,
    readonly database: TestDatabase,
    readonly engine: SyncEngineService,
  ) {
    this.characters = createCharacterService(database.db);
    this.chapters = createChapterService(database.db);
    this.scenes = createSceneService(database.db);
    this.stats = createStatService(database.db);
    this.fields = createStorySchemaFieldService(database.db);
    this.attributes = createAttributeValueService(database.db);
    this.tags = createTagService(database.db);
    this.tagRelations = createTagRelationService(database.db);
    this.characterRelations = createCharacterRelationService(database.db);
    this.favorites = createFavoriteService(database.db);
    this.comments = createCommentService(database.db);
    this.anchors = createChapterAnchorService(database.db);
    this.routes = createRouteService(database.db);
    this.conflicts = createSyncConflictService(database.db);
  }

  get url(): string {
    return `http://${this.name}`;
  }

  /** One full pull/push cycle, without timers. */
  sync(): Promise<'ok' | 'offline' | 'failed'> {
    return (this.engine as any).performSync(new AbortController().signal);
  }

  /**
   * One cycle aborted right after the pull batch was applied locally - the window where the
   * applied operations are durable but the cursor that says so is not written yet (a story
   * switch, the app suspended, a crash).
   */
  syncAbortingAfterPullApply(): Promise<unknown> {
    const controller = new AbortController();
    const pullApply = (this.engine as any).pullApply;
    const original = pullApply.applyBatch;
    pullApply.applyBatch = async (...args: unknown[]) => {
      const result = await original.apply(pullApply, args);
      controller.abort();
      return result;
    };
    return (this.engine as any).performSync(controller.signal).finally(() => {
      pullApply.applyBatch = original;
    });
  }

  /** Any modelled row, read from the local table the entity type maps to. */
  async row(entityType: string, id: string): Promise<Record<string, unknown> | undefined> {
    const table = getEntityTable(entityType)!;
    const rows = await this.database.db
      .select()
      .from(table)
      .where(eq((table as any).id, id))
      .limit(1);
    return rows[0] as Record<string, unknown> | undefined;
  }

  /** Every local row of a modelled type in the story, tombstones included. */
  async rowsOf(entityType: string): Promise<Record<string, unknown>[]> {
    const table = getEntityTable(entityType)!;
    return (await this.database.db
      .select()
      .from(table)
      .where(eq((table as any).storyId, STORY_ID))) as Record<string, unknown>[];
  }

  liveScenes(chapterId: string) {
    return this.database.db.query.scenes.findMany({
      where: and(eq(schema.scenes.chapterId, chapterId), eq(schema.scenes.isDeleted, false)),
    });
  }

  character(id: string) {
    return this.database.db.query.characters.findFirst({
      where: eq(schema.characters.id, id),
    });
  }

  edit(id: string, fields: Record<string, unknown>) {
    return this.characters.updateCharacter(USER_ID, id, fields as never);
  }

  remove(id: string) {
    return this.characters.deleteCharacter(USER_ID, id);
  }

  pendingConflicts() {
    return this.conflicts.getPendingConflicts(STORY_ID);
  }

  async unsyncedOperations() {
    return this.database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.isSynced, false),
    });
  }

  story() {
    return this.database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
  }
}

/** An entity the story starts with, created before any device syncs. */
export interface SeedRow {
  entityType: 'Character' | 'Chapter' | 'Scene' | 'Stat' | 'StorySchemaField';
  id: string;
  fields: Record<string, unknown>;
}

/** A server operation, flattened for a failing seed's trace. */
export type TracedOperation = [
  operationVersion: number,
  operationType: string,
  entity: string,
  payload: unknown,
  entityVersion: number | null,
];

/**
 * Where the devices sync: the in-memory reference model of the protocol, or the real API over
 * HTTP (`apps/api/test/syncFuzz/server.ts`, started by `scripts/sync-fuzz-api.ts`).
 */
export interface SyncBackend {
  /**
   * Empties the server and seeds a story of `type`; `seeder` gives a real client to create rows
   * with. Answers the id of the user the devices sync as.
   */
  prepare(
    seeds: readonly SeedRow[],
    seeder: () => Promise<SyncDevice>,
    type: StoryType,
  ): Promise<string>;
  /** Answers one request of the client's axios, or throws the error it would get. */
  handle(config: any, kind: RequestKind): Promise<unknown>;
  lastOperationVersion(): Promise<number>;
  rows(): Promise<Map<string, Record<string, any>>>;
  compact(keepRecentPerEntity: number): Promise<void>;
  log(): Promise<TracedOperation[]>;
}

export class ReferenceSyncBackend implements SyncBackend {
  readonly server = new ReferenceSyncServer(STORY_ID, MODELLED_COLUMNS);

  async prepare(
    seeds: readonly SeedRow[],
    _seeder: () => Promise<SyncDevice>,
    type: StoryType,
  ): Promise<string> {
    this.server.place('Story', STORY_ID, { type, title: 'Convergence' });
    for (const seed of seeds) this.server.seed(seed.entityType, seed.id, seed.fields);
    return USER_ID;
  }

  async handle(config: any, kind: RequestKind): Promise<unknown> {
    if (kind === 'pull') {
      const cursor = Number(/lastOperationVersion=(\d+)/.exec(`${config.url}`)?.[1] ?? 0);
      return this.server.pull(cursor);
    }
    return this.server.push(JSON.parse(config.data));
  }

  async lastOperationVersion(): Promise<number> {
    return this.server.lastOperationVersion;
  }

  async rows(): Promise<Map<string, Record<string, any>>> {
    return this.server.rows as Map<string, Record<string, any>>;
  }

  async compact(keepRecentPerEntity: number): Promise<void> {
    this.server.compact(keepRecentPerEntity);
  }

  async log(): Promise<TracedOperation[]> {
    return this.server.log.map((row) => [
      row.operationVersion,
      row.operationType,
      `${row.entityType}:${row.entityId}`,
      row.payload,
      row.entityVersion,
    ]);
  }
}

/**
 * A plain HTTP exchange through Node itself: the `fetch` in this environment is Expo's
 * polyfill, which never reaches the network.
 */
function exchange(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        text += chunk;
      });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode ?? 0, data: text ? JSON.parse(text) : null });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

/** The real API: `baseUrl` is the fuzz server's origin (`SYNC_FUZZ_API`). */
export class ApiSyncBackend implements SyncBackend {
  private token = '';

  constructor(readonly baseUrl: string) {}

  private async control<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const { status, data } = await exchange(
      body ? 'POST' : 'GET',
      `${this.baseUrl}${path}`,
      body ? { 'content-type': 'application/json' } : {},
      body ? JSON.stringify(body) : undefined,
    );
    if (status !== 200) throw new Error(`${path} answered ${status}: ${JSON.stringify(data)}`);
    return data as T;
  }

  async prepare(
    seeds: readonly SeedRow[],
    seeder: () => Promise<SyncDevice>,
    type: StoryType,
  ): Promise<string> {
    const reset = await this.control<{ token: string; userId: string }>('/__fuzz/reset', {
      storyId: STORY_ID,
      type,
    });
    this.token = reset.token;
    if (seeds.length === 0) return reset.userId;
    // The server keeps no history for an uploaded story's rows, so seeds are created the way a
    // user would: on a device, then pushed. A scene takes the next index of its chapter.
    const device = await seeder();
    for (const seed of seeds) {
      const data = { id: seed.id, storyId: STORY_ID, ...seed.fields } as never;
      if (seed.entityType === 'Character') await device.characters.createCharacter(USER_ID, data);
      else if (seed.entityType === 'Chapter') await device.chapters.createChapter(USER_ID, data);
      else if (seed.entityType === 'Stat') await device.stats.createStat(USER_ID, data);
      else if (seed.entityType === 'StorySchemaField')
        await device.fields.createField(USER_ID, data);
      else await device.scenes.createScene(USER_ID, data);
    }
    // A few cycles: a refusal it folds (its own default arc into the upload's) queues edits.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await device.sync();
      if ((await device.unsyncedOperations()).length === 0) break;
    }
    if ((await device.unsyncedOperations()).length > 0) {
      throw new Error(
        `The seeder could not push the seed rows: ${JSON.stringify(await device.pendingConflicts())}`,
      );
    }
    return reset.userId;
  }

  async handle(config: any, kind: RequestKind): Promise<unknown> {
    const headers: Record<string, string> = {};
    const raw =
      typeof config.headers?.toJSON === 'function' ? config.headers.toJSON() : config.headers;
    for (const [key, value] of Object.entries(raw ?? {})) {
      if (typeof value === 'string' || typeof value === 'number') headers[key] = String(value);
    }
    headers.Authorization = `Bearer ${this.token}`;
    if (typeof config.data === 'string') headers['Content-Type'] = 'application/json';
    const { status, data } = await exchange(
      String(config.method ?? (kind === 'pull' ? 'get' : 'post')).toUpperCase(),
      `${this.baseUrl}/api${config.url}`,
      headers,
      typeof config.data === 'string' ? config.data : undefined,
    );
    if (process.env.SYNC_FUZZ_TRACE_HTTP === '1' && kind === 'push') {
      process.stderr.write(`PUSH ${config.data}\n  => ${status} ${JSON.stringify(data)}\n`);
    }
    if (status < 200 || status >= 300) {
      const error: any = new Error(`Request failed with status code ${status}`);
      error.config = config;
      error.request = {};
      error.response = { status, data, config, headers: {} };
      throw error;
    }
    return data;
  }

  private snapshot() {
    return this.control<{
      rows: Record<string, Record<string, any>>;
      lastOperationVersion: number;
    }>(`/__fuzz/rows?storyId=${STORY_ID}`);
  }

  async lastOperationVersion(): Promise<number> {
    return (await this.snapshot()).lastOperationVersion;
  }

  async rows(): Promise<Map<string, Record<string, any>>> {
    return new Map(Object.entries((await this.snapshot()).rows));
  }

  async compact(keepRecentPerEntity: number): Promise<void> {
    await this.control('/__fuzz/compact', { storyId: STORY_ID, keep: keepRecentPerEntity });
  }

  async log(): Promise<TracedOperation[]> {
    const rows = await this.control<Record<string, any>[]>(`/__fuzz/log?storyId=${STORY_ID}`);
    return rows.map((row) => [
      row.operationVersion,
      row.operationType,
      `${row.entityType}:${row.entityId}`,
      row.payload,
      row.entityVersion,
    ]);
  }
}

export class SyncHarness {
  readonly devices: SyncDevice[] = [];

  /** The user every device syncs as: the server's own id for it, once `prepare` ran. */
  userId = USER_ID;

  /**
   * @param storyType Routes exist only in branching stories; a linear one hands its start and
   *   finish scenes around.
   */
  constructor(
    readonly backend: SyncBackend = new ReferenceSyncBackend(),
    readonly storyType: StoryType = 'linear',
  ) {}

  /** The reference model itself, for tests that only run against it. */
  get server(): ReferenceSyncServer {
    if (!(this.backend instanceof ReferenceSyncBackend)) {
      throw new Error('This harness syncs with the real API, not the reference server.');
    }
    return this.backend.server;
  }
  /** Runs before the server handles a request - the place to interleave another device. */
  beforeRequest: ((device: SyncDevice, kind: RequestKind) => Promise<void>) | null = null;
  /** Runs after the server handled a request, before the response reaches the device. */
  afterResponse: ((device: SyncDevice, kind: RequestKind) => Promise<void>) | null = null;
  /** Devices whose pulls answer 500 (a reachable server failing), which does not stop the push. */
  readonly failingPulls = new Set<SyncDevice>();
  /** Devices that cannot reach the server at all. */
  readonly offline = new Set<SyncDevice>();
  /** Devices whose pushes reach the server and are applied, but whose answers are lost. */
  readonly losingPushResponses = new Set<SyncDevice>();

  install(): void {
    (axios.defaults as any).adapter = async (config: any) => {
      const device = this.devices.find((candidate) =>
        String(config.baseURL ?? '').startsWith(candidate.url),
      );
      if (!device) throw new Error(`No device for ${config.baseURL}`);
      const url = `${config.url}`;
      const kind: RequestKind = url.includes('/pull') ? 'pull' : 'push';
      if (this.offline.has(device)) {
        const error: any = new Error('Network Error');
        error.code = 'ERR_NETWORK';
        error.config = config;
        error.request = {};
        throw error;
      }
      if (config.signal?.aborted) {
        const error: any = new Error('canceled');
        error.name = 'AbortError';
        error.code = 'ERR_CANCELED';
        error.config = config;
        throw error;
      }
      await this.beforeRequest?.(device, kind);
      if (kind === 'pull' && this.failingPulls.has(device)) {
        const error: any = new Error('Request failed with status code 500');
        error.config = config;
        error.request = {};
        error.response = { status: 500, data: { message: 'boom' }, config, headers: {} };
        throw error;
      }
      let data = await this.backend.handle(config, kind);
      if (kind === 'push' && this.losingPushResponses.has(device)) {
        // The server applied the batch; the answer never arrives.
        const error: any = new Error('Network Error');
        error.code = 'ERR_NETWORK';
        error.config = config;
        error.request = {};
        throw error;
      }
      // Deep copy: the client must never share object identity with the server's state.
      data = JSON.parse(JSON.stringify(data));
      await this.afterResponse?.(device, kind);
      return { data, status: 200, statusText: 'OK', headers: {}, config };
    };
  }

  /**
   * Seeds the story's starting rows and readies the server, before any device syncs. Against the
   * real API a temporary device creates and pushes them.
   */
  async prepare(seeds: readonly SeedRow[]): Promise<void> {
    let seeder: SyncDevice | undefined;
    try {
      this.userId = await this.backend.prepare(
        seeds,
        async () => {
          seeder = await this.addDevice('seeder');
          return seeder;
        },
        this.storyType,
      );
    } finally {
      if (seeder) {
        this.devices.splice(this.devices.indexOf(seeder), 1);
        await seeder.engine.deactivateStory();
        seeder.database.close();
      }
    }
  }

  async addDevice(name: string): Promise<SyncDevice> {
    const database = await createTestDatabase();
    const engine = createAppSyncEngine();
    await engine.bindDatabase(database.db);
    const device = new SyncDevice(name, database, engine);
    const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };
    await database.db.insert(schema.servers).values({
      id: SERVER_ID,
      idUser: this.userId,
      userName: 'ana',
      name: 'Casa',
      url: device.url,
      ...base,
    });
    await database.db.insert(schema.stories).values({
      id: STORY_ID,
      userId: this.userId,
      title: 'Convergence',
      type: this.storyType,
      serverId: SERVER_ID,
      myRole: 'owner',
      ...base,
    });
    await engine.activateStory(STORY_ID, {
      id: SERVER_ID,
      url: device.url,
      idUser: this.userId,
    } as never);
    this.devices.push(device);
    return device;
  }

  /** Runs every device's cycle until a full round changes nothing (bounded). */
  async settle(maxRounds = 8): Promise<void> {
    for (let round = 0; round < maxRounds; round += 1) {
      const before = await this.backend.lastOperationVersion();
      for (const device of this.devices) await device.sync();
      const pending = await Promise.all(
        this.devices.map(async (device) =>
          (await device.unsyncedOperations()).filter((op) => op.conflictState === null),
        ),
      );
      const after = await this.backend.lastOperationVersion();
      if (after === before && pending.every((ops) => ops.length === 0)) {
        // One more pass so every device pulls what the last pushes produced.
        for (const device of this.devices) await device.sync();
        return;
      }
    }
  }

  async dispose(): Promise<void> {
    for (const device of this.devices) {
      await device.engine.deactivateStory();
      device.database.close();
    }
    delete (axios.defaults as any).adapter;
  }
}

/** The fields a convergence check compares, from a local row or a server row. */
export const CONTENT_FIELDS = ['name', 'title', 'description', 'isDeleted', 'version'] as const;

export function contentOf(
  row: Record<string, unknown> | undefined | null,
  entityType = 'Character',
) {
  if (!row) return null;
  const fields = [
    ...(MODELLED_COLUMNS[entityType as keyof typeof MODELLED_COLUMNS] ?? []),
    'isDeleted',
    'version',
  ];
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}
