import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  Favorite,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  SyncConflict as SharedSyncConflict,
  SyncPushResult,
  UpdateStoryUpdate,
} from '@keres/shared';
import { MAX_SYNC_BATCH_SIZE, MAX_SYNC_PULL_BATCH } from '@keres/shared';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import type { OperationLogSelect, ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import type { KeresAxiosInstance } from './apiClient';
import { createKeresAxiosInstance, isOfflineError } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { getEntityTable, omitClientProtectedFields, toEntityColumns } from './entityTableRegistry';
import { AttributeValueClientSyncHandler } from './entity-sync-handlers/AttributeValueClientSyncHandler';
import { ChapterClientSyncHandler } from './entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from './entity-sync-handlers/CharacterClientSyncHandler';
import { CharacterRelationClientSyncHandler } from './entity-sync-handlers/CharacterRelationClientSyncHandler';
import { CharacterSceneClientSyncHandler } from './entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceCheckClientSyncHandler } from './entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from './entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { ChoiceClientSyncHandler } from './entity-sync-handlers/ChoiceClientSyncHandler';
import type { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import { EffectClientSyncHandler } from './entity-sync-handlers/EffectClientSyncHandler';
import { GalleryClientSyncHandler } from './entity-sync-handlers/GalleryClientSyncHandler';
import { GalleryRelationClientSyncHandler } from './entity-sync-handlers/GalleryRelationClientSyncHandler';
import { ItemClientSyncHandler } from './entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from './entity-sync-handlers/ItemJourneyClientSyncHandler';
import { PlotClientSyncHandler } from './entity-sync-handlers/PlotClientSyncHandler';
import { PlotSceneClientSyncHandler } from './entity-sync-handlers/PlotSceneClientSyncHandler';
import { LocationClientSyncHandler } from './entity-sync-handlers/LocationClientSyncHandler';
import { LocationRelationClientSyncHandler } from './entity-sync-handlers/LocationRelationClientSyncHandler';
import { NoteClientSyncHandler } from './entity-sync-handlers/NoteClientSyncHandler';
import { NoteRelationClientSyncHandler } from './entity-sync-handlers/NoteRelationClientSyncHandler';
import { SceneClientSyncHandler } from './entity-sync-handlers/SceneClientSyncHandler';
import { StoryClientSyncHandler } from './entity-sync-handlers/StoryClientSyncHandler';
import { StorySchemaFieldClientSyncHandler } from './entity-sync-handlers/StorySchemaFieldClientSyncHandler';
import { TagClientSyncHandler } from './entity-sync-handlers/TagClientSyncHandler';
import { WorldRuleClientSyncHandler } from './entity-sync-handlers/WorldRuleClientSyncHandler';
import { FavoriteClientSyncHandler } from './entity-sync-handlers/FavoriteClientSyncHandler';
import { SeeAlsoRelationClientSyncHandler } from './entity-sync-handlers/SeeAlsoRelationClientSyncHandler';
import { CommentClientSyncHandler } from './entity-sync-handlers/CommentClientSyncHandler';
import {
  ModeClientSyncHandler,
  StatClientSyncHandler,
  StatRelationClientSyncHandler,
  StatStrengthClientSyncHandler,
} from './entity-sync-handlers/StatClientSyncHandler';
import { SuggestionClientSyncHandler } from './entity-sync-handlers/SuggestionClientSyncHandler';
import type { MediaSyncService } from './MediaSyncService';
import { createMediaSyncService } from './MediaSyncService';
import { createServerService } from './ServerService';
import { createStoryService } from './storymanagement/StoryService';
import { createFavoriteService } from './storymanagement/FavoriteService';
import { createCommentService } from './storymanagement/CommentService';
import type { SyncConflictService } from './SyncConflictService';
import {
  applyReorderToLocalDb,
  createSyncConflictService,
  findContestedFields,
  mergeLocalOperationPayloads,
} from './SyncConflictService';

export interface ServerStoryPreview {
  storyId: string;
  lastOperationVersion: number;
  role: EffectiveStoryRole;
}

/**
 * Local writes already notify the UI with these events. Remote pulls use the
 * same event names so lists and detail screens do not need a second refresh
 * mechanism. The generic event below is kept for screens that aggregate more
 * than one entity type (dashboard and graph views).
 */
const SYNC_ENTITY_EVENTS: Record<string, string> = {
  Story: 'story_changed',
  Character: 'character_changed',
  CharacterRelation: 'character_relation_changed',
  CharacterScene: 'character_scene_changed',
  Tag: 'tag_changed',
  TagRelation: 'tag_relation_changed',
  Note: 'note_changed',
  NoteRelation: 'note_relation_changed',
  WorldRule: 'worldrule_changed',
  Location: 'location_changed',
  LocationRelation: 'location_relation_changed',
  Chapter: 'chapter_changed',
  Scene: 'scene_changed',
  Choice: 'choice_changed',
  ChoiceCheckGroup: 'choice_check_group_changed',
  ChoiceCheck: 'choice_check_changed',
  Effect: 'effect_changed',
  Item: 'item_changed',
  ItemJourney: 'item_journey_changed',
  Plot: 'plot_changed',
  PlotScene: 'plot_scene_changed',
  Gallery: 'gallery_changed',
  GalleryRelation: 'gallery_relation_changed',
  StorySchemaField: 'story_schema_field_changed',
  AttributeValue: 'attribute_value_changed',
  Favorite: 'favorite_changed',
  SeeAlsoRelation: 'see_also_relation_changed',
  Comment: 'comment_changed',
  Suggestion: 'suggestion_changed',
  Stat: 'stat_changed',
  StatStrength: 'stat_strength_changed',
  StatRelation: 'stat_relation_changed',
  Mode: 'mode_changed',
};

const FAVORITE_TARGET_EVENTS: Record<string, string> = {
  Story: 'story_changed',
  Character: 'character_changed',
  Chapter: 'chapter_changed',
  Location: 'location_changed',
  Scene: 'scene_changed',
  Note: 'note_changed',
  WorldRule: 'worldrule_changed',
  Item: 'item_changed',
  Gallery: 'gallery_changed',
  Tag: 'tag_changed',
};

/** Normal cadence while the server is responding. */
export const SYNC_INTERVAL_MS = 30000;
/**
 * Cadence while the server is unreachable. Much shorter than the normal interval so
 * that coming back online is noticed (and announced) within seconds instead of leaving
 * the user staring at an "offline" banner long after the server is back.
 */
export const OFFLINE_RETRY_MS = 5000;

export class SyncEngineService {
  private static instance: SyncEngineService;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning: boolean = false;
  private syncInFlight = false;
  private syncQueued = false;
  private activeSyncOperations = 0;
  private syncIdleResolvers = new Set<() => void>();
  /**
   * Incremented by every start/stop. A cycle captures the value it started under and
   * refuses to schedule its successor once it changes, so a cycle still in flight when
   * sync is restarted can't leave a second timer chain running alongside the new one.
   */
  private syncGeneration: number = 0;
  private storyId: string | null = null;
  /**
   * Held because media transfer does not go through Axios (see `MediaSyncService`) and needs the server
   * to build its authentication on its own.
   */
  private activeServer: ServerSelect | null = null;
  private client: KeresAxiosInstance;
  private intervalTimeMs: number = SYNC_INTERVAL_MS;
  private _db: AppDrizzleClient | null = null;
  private _conflictService: SyncConflictService | null = null;
  private _mediaSyncService: MediaSyncService | null = null;
  private entityHandlers: Map<string, ClientSyncEntityHandler>; // Map to hold entity handlers

  private constructor() {
    this.client = createKeresAxiosInstance();
    this.entityHandlers = new Map<string, ClientSyncEntityHandler>();
    // Register handlers
    this.registerEntityHandler(new StoryClientSyncHandler());
    this.registerEntityHandler(new CharacterClientSyncHandler());
    this.registerEntityHandler(new TagClientSyncHandler());
    this.registerEntityHandler(new NoteClientSyncHandler());
    this.registerEntityHandler(new NoteRelationClientSyncHandler());
    this.registerEntityHandler(new WorldRuleClientSyncHandler());
    this.registerEntityHandler(new CharacterRelationClientSyncHandler());
    this.registerEntityHandler(new LocationClientSyncHandler());
    this.registerEntityHandler(new LocationRelationClientSyncHandler());
    this.registerEntityHandler(new ChapterClientSyncHandler());
    this.registerEntityHandler(new CharacterSceneClientSyncHandler());
    this.registerEntityHandler(new ChoiceClientSyncHandler());
    this.registerEntityHandler(new ChoiceCheckGroupClientSyncHandler());
    this.registerEntityHandler(new ChoiceCheckClientSyncHandler());
    this.registerEntityHandler(new EffectClientSyncHandler());
    this.registerEntityHandler(new ItemClientSyncHandler());
    this.registerEntityHandler(new ItemJourneyClientSyncHandler());
    this.registerEntityHandler(new PlotClientSyncHandler());
    this.registerEntityHandler(new PlotSceneClientSyncHandler());
    this.registerEntityHandler(new SceneClientSyncHandler());
    this.registerEntityHandler(new GalleryClientSyncHandler());
    this.registerEntityHandler(new GalleryRelationClientSyncHandler());
    this.registerEntityHandler(new StorySchemaFieldClientSyncHandler());
    this.registerEntityHandler(new AttributeValueClientSyncHandler());
    this.registerEntityHandler(new FavoriteClientSyncHandler());
    this.registerEntityHandler(new SeeAlsoRelationClientSyncHandler());
    this.registerEntityHandler(new CommentClientSyncHandler());
    this.registerEntityHandler(new SuggestionClientSyncHandler());
    this.registerEntityHandler(new StatClientSyncHandler());
    this.registerEntityHandler(new StatStrengthClientSyncHandler());
    this.registerEntityHandler(new StatRelationClientSyncHandler());
    this.registerEntityHandler(new ModeClientSyncHandler());
  }

  public static getInstance(): SyncEngineService {
    if (!SyncEngineService.instance) {
      SyncEngineService.instance = new SyncEngineService();
    }
    return SyncEngineService.instance;
  }

  private registerEntityHandler(handler: ClientSyncEntityHandler) {
    this.entityHandlers.set(handler.entityName, handler);
  }

  public setDbInstance(dbInstance: AppDrizzleClient) {
    this._db = dbInstance;
    this._conflictService = null; // Recreated on demand, already bound to the new database.
    // Propagate the db instance to all registered handlers
    this.entityHandlers.forEach((handler) => handler.setDb(dbInstance));

    // Inject getServerById into authTokenManager to break circular dependency
    const serverService = createServerService(dbInstance);
    authTokenManager.setGetServerById(serverService.getServerById);
  }

  public async configure(storyId: string | undefined, server: ServerSelect | null) {
    this.storyId = storyId || null;
    this.activeServer = server?.url ? server : null;
    if (server?.url) {
      this.client = createKeresAxiosInstance({ baseURL: server.url });
      // Bind this client to the specific server so the request interceptor always attaches
      // *this* server's token, regardless of what any other concurrent sync/refresh is doing.
      this.client.setTokenProvider(authTokenManager);
      this.client.setActiveServer(server);
      console.log(
        `SyncEngineService configured for story ${this.storyId} with server: ${server.url}`,
      );
    } else {
      console.log('SyncEngineService configured without a server URL. Sync will be disabled.');
      this.stopSync();
    }
  }

  public startSync(intervalTimeMs?: number) {
    if (this.isRunning) {
      console.log('Sync engine already running.');
      return;
    }

    if (!this.storyId) {
      console.log('Cannot start sync: storyId is not set. Call configure() first.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.log(
        'Cannot start sync: server URL is not set. Call configure() with a valid serverUrl.',
      );
      return;
    }

    if (!this._db) {
      console.log('Cannot start sync: Drizzle client (db) is not set. Call setDbInstance() first.');
      return;
    }

    this.intervalTimeMs = intervalTimeMs || this.intervalTimeMs;
    console.log(
      `Starting sync for story ${this.storyId} with interval ${this.intervalTimeMs / 1000}s`,
    );

    this.isRunning = true;
    this.syncGeneration += 1;
    const generation = this.syncGeneration;

    // Self-scheduling rather than setInterval: each cycle picks its own next delay, so
    // an unreachable server is retried quickly while a healthy one keeps the slow
    // cadence. It also guarantees cycles never overlap, which setInterval does not.
    const runCycle = async () => {
      let wasOffline = false;
      try {
        wasOffline = await this.runExclusiveSync();
      } catch (error) {
        if (isOfflineError(error)) {
          console.log('SyncEngineService: sync cycle skipped, server unreachable.');
          wasOffline = true;
        } else {
          console.error('SyncEngineService: Unexpected error during sync cycle.', error);
        }
      }

      // Bail out if sync was stopped, or restarted under a new generation, while this
      // cycle was in flight - otherwise we'd leave a stray timer chain behind.
      if (!this.isRunning || this.syncGeneration !== generation) {
        return;
      }
      this.syncTimer = setTimeout(runCycle, wasOffline ? OFFLINE_RETRY_MS : this.intervalTimeMs);
    };

    // First cycle runs immediately - no waiting for the interval to elapse.
    runCycle();
  }

  /** Coalesced on-demand sync used by realtime notifications and local writes. */
  public requestSync(_reason: 'websocket' | 'initial' | 'local-change' = 'websocket'): void {
    if (!this.storyId || !this._db || !this.client.defaults.baseURL) return;
    void this.runExclusiveSync().catch((error) => {
      console.log('SyncEngineService: on-demand sync failed.', error);
    });
  }

  /**
   * A single runner at a time for the pull/push cycle. The timer and `requestSync` (websocket / local
   * write) share this lock - without it the two ran `performSync` in parallel and could push the same
   * batch twice.
   */
  private async runExclusiveSync(): Promise<boolean> {
    if (this.syncInFlight) {
      this.syncQueued = true;
      return false;
    }
    this.syncInFlight = true;
    try {
      let wasOffline = false;
      do {
        this.syncQueued = false;
        wasOffline = await this.performTrackedSync();
      } while (this.syncQueued);
      return wasOffline;
    } finally {
      this.syncInFlight = false;
    }
  }

  public stopSync() {
    this.isRunning = false;
    this.syncGeneration += 1; // Invalidate any cycle currently in flight
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
      console.log('Sync engine stopped.');
    }
    this.storyId = null;
    this.activeServer = null;
    this.client.defaults.baseURL = undefined;
  }

  private async performTrackedSync(): Promise<boolean> {
    this.activeSyncOperations += 1;
    try {
      return await this.performSync();
    } finally {
      this.activeSyncOperations -= 1;
      if (this.activeSyncOperations === 0) {
        for (const resolve of this.syncIdleResolvers) resolve();
        this.syncIdleResolvers.clear();
      }
    }
  }

  private async waitForSyncIdle(): Promise<void> {
    if (this.activeSyncOperations === 0) return;
    await new Promise<void>((resolve) => this.syncIdleResolvers.add(resolve));
  }

  public async reset(): Promise<void> {
    this.stopSync();
    this.syncQueued = false;
    await this.waitForSyncIdle();
    this.syncInFlight = false;
    this._db = null;
    this._conflictService = null;
    this._mediaSyncService = null;
    console.log('Sync engine has been reset, database instance cleared.');
  }

  public async fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]> {
    if (!server?.url) {
      console.log('A server with a URL is required to fetch story previews.');
      return [];
    }

    // Use a new instance from the factory, bound to this specific server so the
    // interceptor attaches this server's own token rather than whatever another
    // concurrent client last set.
    const tempClient = createKeresAxiosInstance({
      baseURL: server.url,
    });
    tempClient.setTokenProvider(authTokenManager);
    tempClient.setActiveServer(server);

    try {
      const response = await tempClient.get<{
        message: string;
        storyPreviews: ServerStoryPreview[];
      }>('/sync/pullpreviews');
      return response.data.storyPreviews;
    } catch (error) {
      console.log(`Error fetching server story previews from ${server.url}:`, error);
      return [];
    }
  }

  public async downloadAndImportStory(
    queriedServerId: string,
    storyId: string,
    userId: string,
    role: EffectiveStoryRole,
  ): Promise<void> {
    const { showNotification } = useNotificationStore.getState();
    if (!this._db) {
      showNotification(`Failed to download story '${storyId}': Database not set.`, 'error');
      return;
    }
    if (!queriedServerId) {
      showNotification(`Failed to download story '${storyId}': Server ID not set.`, 'error');
      return;
    }
    if (!userId) {
      showNotification(`Failed to download story '${storyId}': User ID not set.`, 'error');
      return;
    }

    let server: ServerSelect | undefined;
    try {
      const serverService = createServerService(this._db);
      server = await serverService.getServerById(queriedServerId);
      if (!server?.url) {
        showNotification(
          `Failed to download story '${storyId}': Server URL not found for ID ${queriedServerId}.`,
          'error',
        );
        return;
      }
    } catch (error) {
      console.error('Error fetching server details by ID:', error);
      showNotification(
        `Failed to download story '${storyId}': Error retrieving server details.`,
        'error',
      );
      return;
    }

    if (!server?.url) {
      return;
    }

    const tempClient = createKeresAxiosInstance({
      baseURL: server.url,
    });
    tempClient.setTokenProvider(authTokenManager);
    tempClient.setActiveServer(server);

    // The title only exists after the download; until then the error notification falls back to the id.
    let storyTitle = storyId;
    try {
      const exportUrl = `/stories/${storyId}/export`;
      console.log(`Attempting to download story ${storyId} from ${server.url}${exportUrl}`);
      const response = await tempClient.get(exportUrl);
      const fullStoryData = response.data;
      storyTitle = fullStoryData?.story?.title || storyId;

      const storyService = createStoryService(this._db);
      await storyService.importFullStory(userId, fullStoryData, queriedServerId, role);
      console.log(`Successfully downloaded and imported story ${storyId} (${storyTitle})`);
      showNotification(i18n.t('story_downloaded_and_imported', { title: storyTitle }), 'success');
    } catch (error) {
      console.log(`Error downloading or importing story ${storyId} from ${server.url}:`, error);
      showNotification(i18n.t('failed_to_download_story_named', { title: storyTitle }), 'error');
    }
  }

  /**
   * Sends a fully local story (a null `serverId`) to a server for the first time.
   *
   * It checks existence directly against the server (not through `fetchServerStoryPreviews`, which
   * swallows network errors and would return `[]` - which would look like "does not exist" even when the
   * check merely failed for being offline) before exporting and sending it through `POST
   * /stories/import?storyId=`, preserving the local ID. The API-side check
   * (`StoryExportImportService.importStory`, scoped by id+user) is the backstop should two calls race.
   */
  public async uploadNewStoryToServer(
    storyId: string,
    server: ServerSelect,
    userId: string,
  ): Promise<
    { success: true } | { success: false; reason: 'already_exists' | 'error'; message?: string }
  > {
    if (!this._db) {
      return { success: false, reason: 'error', message: 'Database not set.' };
    }
    if (!server?.url) {
      return { success: false, reason: 'error', message: 'Server URL not set.' };
    }

    const tempClient = createKeresAxiosInstance({ baseURL: server.url });
    tempClient.setTokenProvider(authTokenManager);
    tempClient.setActiveServer(server);

    try {
      const previewsResponse = await tempClient.get<{
        message: string;
        storyPreviews: ServerStoryPreview[];
      }>('/sync/pullpreviews');
      if (previewsResponse.data.storyPreviews.some((preview) => preview.storyId === storyId)) {
        return { success: false, reason: 'already_exists' };
      }
    } catch (error) {
      console.log(`Error checking story existence on ${server.url}:`, error);
      return { success: false, reason: 'error', message: (error as Error)?.message };
    }

    const storyService = createStoryService(this._db);
    const story = await storyService.getStoryById(storyId);
    if (!story) {
      return { success: false, reason: 'error', message: `Story ${storyId} not found locally.` };
    }
    const storyExport = await storyService.exportFullStory(storyId);

    try {
      await tempClient.post(`/stories/import?storyId=${encodeURIComponent(storyId)}`, storyExport);
    } catch (error) {
      console.log(`Error uploading story ${storyId} to ${server.url}:`, error);
      return { success: false, reason: 'error', message: (error as Error)?.message };
    }

    // The server now has exactly what the local op-log had at the moment of the export - that is the right
    // base for the next sync cycle, not the exported package's `serverLastOperationVersion` (which reflects
    // an earlier link, always 0 for a story that was never linked).
    await createFavoriteService(this._db).migrateUserIdentity(storyId, userId, server.idUser);
    await createCommentService(this._db).migrateAuthorIdentity(storyId, userId, server.idUser);
    // Those operations are already represented by the imported snapshot. Resending them would carry the old
    // local identity, which does not exist on the server, and would duplicate the comment.
    await this._db
      .update(schema.operationLogs)
      .set({ isSynced: true })
      .where(
        and(
          eq(schema.operationLogs.storyId, storyId),
          sql`${schema.operationLogs.entityType} in ('Favorite', 'Comment')`,
          lte(schema.operationLogs.operationVersion, story.lastOperationLog),
        ),
      );
    await storyService.updateStory(userId, storyId, {
      serverId: server.id,
      lastServerSyncedLog: story.lastOperationLog,
      lastPublicFavoriteLog: 0,
      // Known synchronously: the caller is the one linking their own local story to the
      // server, so there's no ambiguity to wait on a later sync pull to resolve.
      myRole: 'owner',
    });

    return { success: true };
  }

  private get conflictService(): SyncConflictService {
    if (!this._conflictService) {
      if (!this._db) {
        throw new Error(
          'SyncEngineService: cannot use the conflict service before setDbInstance().',
        );
      }
      this._conflictService = createSyncConflictService(this._db);
    }
    return this._conflictService;
  }

  /**
   * The version the user based their edit on.
   *
   * Every local service increments `version` by exactly 1 and writes the *resulting* version into the
   * operation's payload. The server needs the base, not the result: it is by comparing the base with the
   * version it holds now that it discovers whether somebody wrote in between. Sending the result (as used
   * to happen) made the check always pass.
   */
  private deriveBaseVersion(payload: Record<string, any>): number | undefined {
    const resultingVersion = payload?.version;
    if (typeof resultingVersion !== 'number' || resultingVersion < 1) {
      return undefined;
    }
    return resultingVersion - 1;
  }

  /** The key for grouping operations and conflicts by entity. */
  private entityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  /** Strips local bookkeeping columns from a remote update before applying it. */
  private protectRemoteUpdate(update: StoryUpdate): StoryUpdate {
    if (update.type === 'create') {
      return {
        ...update,
        data: omitClientProtectedFields(update.entity, update.data),
      } as CreateStoryUpdate;
    }
    if (update.type === 'update') {
      return {
        ...update,
        changes: omitClientProtectedFields(update.entity, update.changes),
      } as UpdateStoryUpdate;
    }
    return update;
  }

  /** Runs one full pull/push cycle. Resolves to true when the server was unreachable. */
  private async performSync(): Promise<boolean> {
    const { showNotification } = useNotificationStore.getState();
    if (!this.storyId) {
      console.log('No storyId set for sync operation.');
      return false;
    }

    if (!this.client.defaults.baseURL) {
      console.log('No server URL set for sync operation.');
      this.stopSync();
      return false;
    }

    if (!this._db) {
      console.log('Drizzle client (db) is not initialized. Cannot perform sync.');
      this.stopSync();
      return false;
    }

    try {
      // 1. Get local story details and initial server max operation version
      const localStory = await this._db.query.stories.findFirst({
        where: eq(schema.stories.id, this.storyId),
        columns: {
          id: true,
          version: true,
          lastServerSyncedLog: true,
          lastPublicFavoriteLog: true,
          myRole: true,
        },
      });

      if (!localStory) {
        console.log(`Story with ID ${this.storyId} not found locally.`);
        this.stopSync();
        return false;
      }

      const lastSyncedLog = localStory.lastServerSyncedLog || 0;
      const lastPublicFavoriteLog = localStory.lastPublicFavoriteLog || 0;

      // 2. Pull remote updates first (since the latest known server version).
      // The server returns at most MAX_SYNC_PULL_BATCH ops; we repeat until a page comes back incomplete, so
      // as not to leave a large backlog for the next cycle.
      console.log(
        `Pulling remote updates for story ${this.storyId} since version ${lastSyncedLog}...`,
      );
      const remoteUpdates: StoryUpdate[] = [];
      let publicFavorites: Favorite[] = [];
      let myRole: 'owner' | 'writer' | 'reader' = localStory.myRole || 'reader';
      let pullCursor = lastSyncedLog;
      for (let page = 0; page < 20; page += 1) {
        const pullResponse = await this.client.get<{
          updates: StoryUpdate[];
          publicFavorites?: Favorite[];
          serverMaxOperationVersion: number;
          role: 'owner' | 'writer' | 'reader';
        }>(
          `/sync/${this.storyId}/pull?lastOperationVersion=${pullCursor}&lastPublicFavoriteVersion=${lastPublicFavoriteLog}`,
        );
        const pageUpdates = pullResponse.data.updates ?? [];
        publicFavorites = pullResponse.data.publicFavorites ?? publicFavorites;
        if (pullResponse.data.role) myRole = pullResponse.data.role;
        remoteUpdates.push(...pageUpdates);
        if (pageUpdates.length === 0) break;
        pullCursor = Math.max(
          pullCursor,
          ...pageUpdates.map((update) => update.operationVersion || 0),
        );
        if (pageUpdates.length < MAX_SYNC_PULL_BATCH) break;
      }

      /**
       * We move the marker only up to the highest operation that actually arrived, and not up to the
       * response's `serverMaxOperationVersion`. The two are read in separate queries on the server: an
       * operation written between them makes it into the maximum but not into the list, and trusting the
       * maximum would skip it forever.
       */
      let highestAppliedRemoteVersion = lastSyncedLog;
      let highestAppliedPublicFavoriteVersion = lastPublicFavoriteLog;
      let publicFavoriteCursorBlocked = false;
      const markRemoteOperationApplied = (update: StoryUpdate) => {
        highestAppliedRemoteVersion = Math.max(
          highestAppliedRemoteVersion,
          update.operationVersion || 0,
        );
        if (update.entity === 'Favorite' && !publicFavoriteCursorBlocked) {
          highestAppliedPublicFavoriteVersion = Math.max(
            highestAppliedPublicFavoriteVersion,
            update.operationVersion || 0,
          );
        }
      };

      if (remoteUpdates && remoteUpdates.length > 0) {
        let totalUpdates = remoteUpdates.length;
        let entitiesUpdated: string[] = [];
        let failedEntities: string[] = [];
        const changedEntityIds = new Map<string, Set<string>>();

        const markEntityUpdated = (entity: string, entityId?: string) => {
          if (!entitiesUpdated.includes(entity)) {
            entitiesUpdated.push(entity);
          }
          if (entityId) {
            const ids = changedEntityIds.get(entity) ?? new Set<string>();
            ids.add(entityId);
            changedEntityIds.set(entity, ids);
          }
        };

        console.log(`Received ${totalUpdates} remote updates. Applying to local DB...`);

        // Local operations not yet accepted by the server, indexed by entity. They are what remote updates can
        // collide with: applying the remote version on top would silently erase what the user wrote offline.
        const pendingByEntity = await this.getPendingOperationsByEntity();
        let conflictsDetected = 0;
        let pullBlocked = false;

        for (const rawUpdate of remoteUpdates) {
          if (pullBlocked) break;

          const update = this.protectRemoteUpdate(rawUpdate);
          const handler = this.entityHandlers.get(update.entity);
          if (!handler) {
            console.log(`No client sync handler registered for entity type: ${update.entity}`);
            pullBlocked = true;
            break;
          }

          if (update.entity === 'Story' && update.type === 'create' && update.id !== this.storyId) {
            console.warn(`Ignoring Story create for ${update.id} while syncing ${this.storyId}.`);
            await this.recordRemoteOperationLocally(rawUpdate);
            markRemoteOperationApplied(rawUpdate);
            continue;
          }

          // An operation this very client sent and the server is handing back. It is already applied here;
          // reapplying it would only duplicate the row in the local log.
          if (await this.isOwnEchoedOperation(rawUpdate)) {
            markRemoteOperationApplied(rawUpdate);
            continue;
          }

          const pendingLocalOps =
            pendingByEntity.get(this.entityKey(update.entity, update.id || '')) || [];

          try {
            if (pendingLocalOps.length > 0) {
              const outcome = await this.reconcileRemoteUpdate(update, pendingLocalOps, handler);
              if (outcome.conflicted) {
                conflictsDetected += 1;
              }
              markEntityUpdated(update.entity, update.id);
              await this.recordRemoteOperationLocally(rawUpdate);
              markRemoteOperationApplied(rawUpdate);
              continue;
            }

            if (update.type === 'create') {
              await this.applyRemoteCreate(update, handler);
            } else if (update.type === 'update') {
              await handler.applyUpdate(this.storyId, update);
            } else if (update.type === 'delete') {
              await handler.applyDelete(this.storyId, update);
            } else if (update.type === 'reorder') {
              const reorderUpdate = update as
                | ChapterReorderingStoryUpdate
                | StoryReorderingStoryUpdate;

              if (!reorderUpdate.reorderItems || reorderUpdate.reorderItems.length === 0) {
                console.warn(
                  `Reorder update for entity ${update.entity} ID ${update.id} has no reorderItems.`,
                );
                pullBlocked = true;
                break;
              }

              await applyReorderToLocalDb(this._db, reorderUpdate, new Date(update.operationTime!));
            }
            markEntityUpdated(update.entity, update.id);

            await this.recordRemoteOperationLocally(rawUpdate);
            markRemoteOperationApplied(rawUpdate);
          } catch (handlerError) {
            pullBlocked = true;
            if (
              update.entity === 'Favorite' &&
              (update.operationVersion || 0) > lastPublicFavoriteLog
            ) {
              publicFavoriteCursorBlocked = true;
            }
            console.log(
              `Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`,
              handlerError,
            );
            if (!failedEntities.includes(update.entity)) {
              failedEntities.push(update.entity);
            }
          }
        }

        // One consolidated notification per sync cycle instead of one per failed
        // item - a single flaky entity type shouldn't flood the user with a
        // notification for every record it touches.
        if (entitiesUpdated.length > 0) {
          showNotification(
            i18n.t('sync_updates_received', {
              count: totalUpdates,
              entities: entitiesUpdated.join(', '),
            }),
            'info',
          );
        }
        if (failedEntities.length > 0) {
          showNotification(
            i18n.t('sync_failed_to_apply_updates', { entities: failedEntities.join(', ') }),
            'error',
          );
        }
        if (conflictsDetected > 0) {
          showNotification(
            i18n.t('sync_conflicts_detected', { count: conflictsDetected }),
            'warning',
          );
        }
        // Emit events after the whole pull so a batch causes one refresh per
        // affected entity type instead of one query per operation.
        for (const [entity, ids] of changedEntityIds) {
          const eventName = SYNC_ENTITY_EVENTS[entity];
          if (!eventName) continue;
          for (const entityId of ids) {
            if (entity === 'Favorite') {
              const favorite = await this._db.query.favorites.findFirst({
                where: eq(schema.favorites.id, entityId),
                columns: { entityId: true, entityType: true, userId: true },
              });
              if (favorite) {
                entityEventEmitter.emit(
                  'favorite_changed',
                  this.storyId,
                  favorite.entityType,
                  favorite.entityId,
                  favorite.userId,
                );
              }
              const targetEvent = favorite && FAVORITE_TARGET_EVENTS[favorite.entityType];
              if (targetEvent)
                entityEventEmitter.emit(targetEvent, this.storyId, favorite.entityId);
            } else {
              entityEventEmitter.emit(eventName, this.storyId, entityId);
            }
          }
        }
        entityEventEmitter.emit('story_data_changed', {
          storyId: this.storyId,
          entityTypes: Array.from(changedEntityIds.keys()),
          entityIds: Object.fromEntries(
            Array.from(changedEntityIds.entries()).map(([entity, ids]) => [
              entity,
              Array.from(ids),
            ]),
          ),
          source: 'sync',
        });

        // Emit event to signal operation log update after applying remote updates
        entityEventEmitter.emit('operation_log_updated', this.storyId);
      } else {
        console.log(
          `No new remote updates for story ${this.storyId} since version ${lastSyncedLog}`,
        );
      }

      // The public snapshot is the authoritative source for collaborators' favourites. It closes gaps left by
      // stories imported without old logs and by cursors of clients that had already moved on before public
      // visibility was enabled. The server excludes the current user's rows so as not to overwrite a local
      // change of theirs that is still to be sent in the next step of this same cycle.
      if (publicFavorites.length > 0) {
        const favoriteHandler = this.entityHandlers.get('Favorite');
        if (!favoriteHandler) {
          throw new Error('Favorite sync handler is not registered.');
        }

        for (const favorite of publicFavorites) {
          const localFavorite = (await favoriteHandler.getById(favorite.id)) as
            | Favorite
            | undefined;
          const changed =
            !localFavorite ||
            localFavorite.version !== favorite.version ||
            localFavorite.isDeleted !== favorite.isDeleted ||
            localFavorite.entityId !== favorite.entityId ||
            localFavorite.entityType !== favorite.entityType ||
            localFavorite.userId !== favorite.userId;
          if (!changed) continue;

          await this.applyRemoteCreate(
            this.protectRemoteUpdate({
              type: 'create',
              entity: 'Favorite',
              id: favorite.id,
              data: favorite,
              version: favorite.version,
            } as CreateStoryUpdate) as CreateStoryUpdate,
            favoriteHandler,
          );

          entityEventEmitter.emit(
            'favorite_changed',
            this.storyId,
            favorite.entityType,
            favorite.entityId,
            favorite.userId,
          );
          const targetEvent = FAVORITE_TARGET_EVENTS[favorite.entityType];
          if (targetEvent) entityEventEmitter.emit(targetEvent, this.storyId, favorite.entityId);
        }
      }

      // 3-4. Push pending local operations in batches the server will accept.
      try {
        const pushed = await this.pushPendingOperations();
        if (pushed.offline) {
          return true;
        }
      } catch (pushError: any) {
        if (isOfflineError(pushError)) {
          console.log(`Push skipped for story ${this.storyId}: server unreachable.`);
          return true;
        }
        console.log(
          `Error pushing local operations for story ${this.storyId}:`,
          pushError?.message || pushError,
        );
        showNotification(i18n.t('sync_push_failed'), 'error');
      }

      // 5. Update local story's lastServerSyncedLog and cached role
      const roleChanged = myRole && myRole !== localStory.myRole;
      await this._db
        .update(schema.stories)
        .set({
          lastServerSyncedLog: highestAppliedRemoteVersion,
          lastPublicFavoriteLog: highestAppliedPublicFavoriteVersion,
          myRole,
        })
        .where(eq(schema.stories.id, this.storyId));
      if (roleChanged) {
        entityEventEmitter.emit('story_role_changed', this.storyId);
      }

      // Reaching here means the pull round-trip against the server succeeded, so this is
      // a real "last synced" timestamp - not just when the server was registered (which is
      // all `servers.lastSyncDate` ever reflected before, since nothing else touched it).
      if (this.activeServer) {
        const serverService = createServerService(this._db);
        await serverService.updateServer(this.activeServer.id, { lastSyncDate: new Date() });
      }

      // 6. Reconcile media files. It runs after the metadata on purpose: a media file can only be downloaded
      // after the row describing it has arrived, and can only be uploaded after the server has accepted that
      // same row.
      return await this.syncMedia();
    } catch (error: any) {
      if (isOfflineError(error)) {
        // Offline-first: an unreachable server is expected, not a failure worth
        // interrupting the user for. Retried on a shorter delay.
        console.log(`Sync skipped for story ${this.storyId}: server unreachable.`);
        return true;
      }
      console.log('Error during sync operation:', error?.message || error);
      showNotification(i18n.t('sync_failed'), 'error');
      return false;
    }
  }

  /**
   * Uploads and downloads the gallery's files. It resolves to `true` if the server is unreachable, so the
   * cycle treats it as offline.
   *
   * A failure here never takes synchronization down: media that did not transfer stays marked as pending
   * and is tried again in the next cycle, while the story's text keeps synchronizing normally.
   */
  private async syncMedia(): Promise<boolean> {
    if (!this._db || !this.storyId || !this.activeServer) {
      return false;
    }

    try {
      if (!this._mediaSyncService) {
        this._mediaSyncService = createMediaSyncService(this._db);
      }
      const summary = await this._mediaSyncService.syncStoryMedia(
        this.client,
        this.activeServer,
        this.storyId,
      );

      if (summary.uploaded > 0 || summary.downloaded > 0) {
        console.log(
          `Media sync for story ${this.storyId}: ${summary.uploaded} uploaded, ${summary.downloaded} downloaded, ${summary.failed} failed.`,
        );
        entityEventEmitter.emit('gallery_changed', this.storyId);
      }
      return summary.offline;
    } catch (error) {
      console.log(`Media sync skipped for story ${this.storyId}.`, error);
      return false;
    }
  }

  /**
   * Pushes the local queue in slices of `MAX_SYNC_BATCH_SIZE`. Without it a backlog of 201+ ops (a long
   * offline session) takes a 422 from the server's schema and never synchronizes.
   */
  private async pushPendingOperations(): Promise<{ offline: boolean }> {
    const { showNotification } = useNotificationStore.getState();
    let totalApplied = 0;
    let totalConflicts = 0;

    for (let chunk = 0; chunk < 50; chunk += 1) {
      const pending = await this.getPushableOperations();
      const mapped: { op: OperationLogSelect; update: StoryUpdate }[] = [];
      for (const op of pending) {
        const update = this.buildStoryUpdateFromLocalOp(op);
        if (update) mapped.push({ op, update });
      }
      const prepared = mapped.slice(0, MAX_SYNC_BATCH_SIZE);
      if (prepared.length === 0) break;

      if (chunk === 0) {
        console.log(`Pushing local operations for story ${this.storyId} to server...`);
      }

      const pushResponse = await this.client.post<SyncPushResult>(
        `/sync/${this.storyId}`,
        prepared.map((entry) => entry.update),
      );
      const summary = await this.applyPushResult(
        pushResponse.data,
        prepared.map((entry) => entry.op),
        { silent: true },
      );
      totalApplied += summary.applied;
      totalConflicts += summary.conflicts;

      const remaining = await this.getPushableOperations();
      if (remaining.length >= pending.length) {
        break;
      }
    }

    if (totalApplied > 0) {
      showNotification(i18n.t('sync_pushed_updates', { count: totalApplied }), 'success');
    }
    if (totalConflicts > 0) {
      showNotification(i18n.t('sync_conflicts_detected', { count: totalConflicts }), 'warning');
    }
    return { offline: false };
  }

  private buildStoryUpdateFromLocalOp(op: OperationLogSelect): StoryUpdate | null {
    const payloadData = JSON.parse(op.payload);
    const baseVersion = this.deriveBaseVersion(payloadData);

    if (op.operationType === 'update' && typeof baseVersion !== 'number') {
      console.warn(
        `Skipping update ${op.entityType} ${op.entityId}: payload has no version, server would 422 the whole batch.`,
      );
      return null;
    }
    if (op.operationType === 'create' && !op.entityId) {
      console.warn(`Skipping create of ${op.entityType}: missing entity id.`);
      return null;
    }

    const baseUpdate: Omit<StoryUpdate, 'type'> = {
      entity: op.entityType,
      id: op.entityId,
      version: baseVersion,
      operationTime: op.createdAt.toISOString(),
      clientOperationId: op.id,
    };

    const filteredPayloadData: Record<string, any> = { ...payloadData };
    delete filteredPayloadData.createdAt;
    delete filteredPayloadData.updatedAt;
    delete filteredPayloadData.deletedAt;
    delete filteredPayloadData.storyId;

    switch (op.operationType) {
      case 'create':
        return {
          ...baseUpdate,
          type: 'create',
          data: filteredPayloadData,
        } as CreateStoryUpdate;
      case 'update':
        return {
          ...baseUpdate,
          type: 'update',
          changes: {
            ...filteredPayloadData,
            version: baseVersion,
          },
        } as UpdateStoryUpdate;
      case 'delete':
        return {
          ...baseUpdate,
          type: 'delete',
        } as DeleteStoryUpdate;
      case 'reorder':
        if (op.entityType === 'Chapter' && Array.isArray(filteredPayloadData.reorderItems)) {
          return {
            ...baseUpdate,
            type: 'reorder',
            entity: 'Chapter',
            reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({
              ...item,
            })),
          } as ChapterReorderingStoryUpdate;
        }
        if (op.entityType === 'Story' && Array.isArray(filteredPayloadData.reorderItems)) {
          return {
            ...baseUpdate,
            type: 'reorder',
            entity: 'Story',
            reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({
              ...item,
            })),
            reorderTarget: filteredPayloadData.reorderTarget,
            schemaEntityType: filteredPayloadData.schemaEntityType,
          } as StoryReorderingStoryUpdate;
        }
        console.warn(
          `Unhandled reorder operation type or entity: ${op.entityType}, ${op.operationType}`,
        );
        return null;
      default:
        console.warn(`Unhandled operation type: ${op.operationType}`);
        return null;
    }
  }

  /**
   * Local operations that can go to the server: not yet synchronized and with no pending conflict.
   * Excluding the conflicted ones is what stops the cycle from resending forever an operation the server
   * has already refused.
   */
  private async getPushableOperations(): Promise<OperationLogSelect[]> {
    return this._db!.query.operationLogs.findMany({
      where: and(
        eq(schema.operationLogs.storyId, this.storyId!),
        eq(schema.operationLogs.isSynced, false),
        isNull(schema.operationLogs.conflictState),
      ),
      // Ordered by operationVersion (strictly monotonic per story), not createdAt: the SQLite
      // timestamp column only has second precision, so two writes in the same second (e.g. a
      // Gallery create immediately followed by its GalleryRelation create) could tie under
      // createdAt and push in the wrong order, making the server reject the dependent create.
      orderBy: ({ operationVersion }) => [asc(operationVersion)],
    });
  }

  /** Pending local operations grouped by entity, to cross-reference with what comes from the pull. */
  private async getPendingOperationsByEntity(): Promise<Map<string, OperationLogSelect[]>> {
    const pending = await this.getPushableOperations();
    const byEntity = new Map<string, OperationLogSelect[]>();
    for (const op of pending) {
      const key = this.entityKey(op.entityType, op.entityId);
      const bucket = byEntity.get(key);
      if (bucket) {
        bucket.push(op);
      } else {
        byEntity.set(key, [op]);
      }
    }
    return byEntity;
  }

  /**
   * Is the operation that came from the pull already recorded locally?
   *
   * It covers two cases: operations this client pushed and the server is handing back, and remote
   * operations an earlier pull already applied. In both, reapplying is unnecessary and would duplicate the
   * row in the local log.
   */
  private async isOwnEchoedOperation(update: StoryUpdate): Promise<boolean> {
    if (!update.operationVersion) {
      return false;
    }
    const existing = await this._db!.query.operationLogs.findFirst({
      where: and(
        eq(schema.operationLogs.storyId, this.storyId!),
        eq(schema.operationLogs.serverOperationVersion, update.operationVersion),
        eq(schema.operationLogs.isSynced, true),
      ),
      columns: { id: true },
    });
    return !!existing;
  }

  /**
   * Applies a remote create tolerating that the entity may already exist.
   *
   * A raw `insert` would fail when repeating the operation (for instance if an earlier push's response
   * was lost and the server returned the create in the next pull), and the failure was counted as "error
   * applying a remote update" without anything actually having gone wrong.
   */
  private async applyRemoteCreate(
    update: StoryUpdate,
    handler: ClientSyncEntityHandler,
  ): Promise<void> {
    const createUpdate = update as CreateStoryUpdate;
    const existing = update.id ? await handler.getById(update.id) : undefined;

    if (!existing) {
      await handler.applyCreate(this.storyId!, createUpdate);
      return;
    }

    await handler.applyUpdate(this.storyId!, {
      ...createUpdate,
      type: 'update',
      id: update.id!,
      changes: {
        ...createUpdate.data,
        version:
          typeof createUpdate.data?.version === 'number'
            ? createUpdate.data.version
            : (createUpdate.version ?? 0),
      },
    } as UpdateStoryUpdate);
  }

  /**
   * Records an operation coming from the server in the local log.
   *
   * The id used is the operation's id *on the server*. It used to be the entity's id, which made the
   * second operation on the same entity collide on the primary key - the failure was swallowed and
   * reported to the user as "failed to apply remote updates".
   */
  private async recordRemoteOperationLocally(update: StoryUpdate): Promise<void> {
    const payloadToStore =
      update.type === 'create'
        ? update.data
        : update.type === 'update'
          ? update.changes
          : update.type === 'reorder'
            ? { reorderItems: update.reorderItems }
            : { id: update.id }; // For delete, just store the ID

    await this._db!.insert(schema.operationLogs)
      .values({
        id: update.operationId || createULID(),
        storyId: this.storyId!,
        userId: update.originatingUser || 'unknown',
        operationVersion: update.operationVersion || 0,
        operationType: update.type,
        entityType: update.entity,
        entityId: update.id!,
        payload: JSON.stringify(payloadToStore),
        createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
        isSynced: true, // Mark as synced because it came from the server
        serverOperationVersion: update.operationVersion || 0,
      })
      .onConflictDoNothing();
  }

  /**
   * Reconciles a remote update with local edits on the same entity that have not been accepted yet.
   *
   * The rule is to preserve what the person did: fields only the server changed are applied, fields the
   * person also changed keep their value and become a conflict for them to decide. Before, the remote
   * update was written on top and the offline edit disappeared with no warning.
   */
  private async reconcileRemoteUpdate(
    update: StoryUpdate,
    pendingLocalOps: OperationLogSelect[],
    handler: ClientSyncEntityHandler,
  ): Promise<{ conflicted: boolean }> {
    const entityId = update.id!;

    // Reorder does not fit the rest of this function: the disputed value is the whole order
    // (`reorderItems`), not an entity's scalar fields - `mergeLocalOperationPayloads`/`findContestedFields`
    // make no sense for it.
    if (update.type === 'reorder') {
      return this.reconcileRemoteReorder(
        update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
        entityId,
        pendingLocalOps,
      );
    }

    const localWantsDelete = pendingLocalOps.some((op) => op.operationType === 'delete');
    const localValues = mergeLocalOperationPayloads(pendingLocalOps);
    const localOperationIds = pendingLocalOps.map((op) => op.id);
    const localOperationType = localWantsDelete
      ? 'delete'
      : pendingLocalOps.some((op) => op.operationType === 'create')
        ? 'create'
        : 'update';

    const recordConflict = (
      reason: 'deleted_on_server' | 'edited_on_server' | 'concurrent_edit',
      serverValues: Record<string, any> | null,
    ) =>
      this.conflictService.recordConflict({
        storyId: this.storyId!,
        entityType: update.entity,
        entityId,
        reason,
        localOperationType,
        localOperationIds,
        localValues,
        serverValues,
        clientVersion: this.deriveBaseVersion(JSON.parse(pendingLocalOps[0].payload)) ?? null,
        serverVersion: update.version ?? null,
        message:
          update.type === 'delete'
            ? `Server deleted ${update.entity} ${entityId} while it had unsynced local edits.`
            : `Server and local changes overlap on ${update.entity} ${entityId}.`,
      });

    if (update.type === 'delete') {
      if (localWantsDelete) {
        // Both sides deleted: the same intent, nothing to decide.
        await handler.applyDelete(this.storyId!, update as DeleteStoryUpdate);
        return { conflicted: false };
      }
      // The remote deletion is deliberately not applied: discarding what the person wrote here would take
      // away their chance to recover the entity.
      await recordConflict('deleted_on_server', { isDeleted: true, version: update.version });
      return { conflicted: true };
    }

    const remoteValues: Record<string, any> =
      update.type === 'create'
        ? { ...(update as CreateStoryUpdate).data }
        : update.type === 'update'
          ? { ...(update as UpdateStoryUpdate).changes }
          : {};

    if (localWantsDelete) {
      await recordConflict('edited_on_server', remoteValues);
      return { conflicted: true };
    }

    const contestedFields = findContestedFields(localValues, remoteValues);
    const mergeableEntries = Object.entries(remoteValues).filter(
      ([key]) => !contestedFields.includes(key),
    );

    if (mergeableEntries.length > 0) {
      await handler.applyUpdate(this.storyId!, {
        ...update,
        type: 'update',
        id: entityId,
        changes: Object.fromEntries(mergeableEntries),
      } as UpdateStoryUpdate);
    }

    if (contestedFields.length === 0) {
      // The two edits fit together. The local one only has to be rebased onto the new version, and then it
      // goes through on the next push without bothering the user with a decision.
      await this.rebasePendingOperations(pendingLocalOps, update.version);
      return { conflicted: false };
    }

    await recordConflict('concurrent_edit', remoteValues);
    return { conflicted: true };
  }

  /**
   * The counterpart of `reconcileRemoteUpdate` for reorder alone - extracted separately because the
   * disputed value (`reorderItems`) is not a set of one entity's fields, it is the whole order of N other
   * rows (a Chapter's Scenes, or a Story's Chapters).
   */
  private async reconcileRemoteReorder(
    update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
    entityId: string,
    pendingLocalOps: OperationLogSelect[],
  ): Promise<{ conflicted: boolean }> {
    const localReorderOp = pendingLocalOps.find((op) => op.operationType === 'reorder');

    if (!localReorderOp) {
      // What is pending on this entity is of another kind (renaming a chapter, say) - it does not conflict
      // with the order coming from the server, which can be applied directly.
      await applyReorderToLocalDb(this._db!, update, new Date(update.operationTime!));
      return { conflicted: false };
    }

    const localPayload = JSON.parse(localReorderOp.payload);
    await this.conflictService.recordConflict({
      storyId: this.storyId!,
      entityType: update.entity,
      entityId,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [localReorderOp.id],
      localValues: { reorderItems: localPayload.reorderItems ?? [] },
      serverValues: {
        reorderItems: update.reorderItems,
        reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
      },
      clientVersion: this.deriveBaseVersion(localPayload) ?? null,
      serverVersion: update.version ?? null,
      message: `Server and local changes overlap on ordering ${update.entity} ${entityId}.`,
    });
    return { conflicted: true };
  }

  /**
   * Rewrites the base of the pending local operations to the version the entity holds now, chaining them
   * (the first rests on the new version, the second on the following one, and so on) so the server accepts
   * them in sequence.
   */
  private async rebasePendingOperations(
    pendingLocalOps: OperationLogSelect[],
    newEntityVersion?: number,
  ): Promise<void> {
    if (typeof newEntityVersion !== 'number') {
      return;
    }

    let base = newEntityVersion;
    for (const op of pendingLocalOps) {
      const payload = JSON.parse(op.payload);
      // The engine derives the base as `payload.version - 1`, so we write base + 1.
      payload.version = base + 1;
      await this._db!.update(schema.operationLogs)
        .set({ payload: JSON.stringify(payload) })
        .where(eq(schema.operationLogs.id, op.id));
      base += 1;
    }
  }

  /**
   * Processes the push's response: it marks as synchronized only the operations the server accepted and
   * turns the refused ones into pending conflicts.
   *
   * Before, any 2xx response marked *every* operation as synchronized, so a refused operation was silently
   * discarded - the user's edit simply disappeared.
   */
  private async applyPushResult(
    result: SyncPushResult,
    pushedOperations: OperationLogSelect[],
    options: { silent?: boolean } = {},
  ): Promise<{ applied: number; conflicts: number }> {
    const { showNotification } = useNotificationStore.getState();

    if (!Array.isArray(result?.applied) && !Array.isArray(result?.conflicts)) {
      // A server predating this change: there is no per-operation result to inspect. We keep the old
      // behaviour rather than stop synchronizing with it.
      console.log(
        'SyncEngineService: server did not report per-operation results, assuming the whole batch was applied.',
      );
      for (const op of pushedOperations) {
        await this._db!.update(schema.operationLogs)
          .set({ isSynced: true, serverOperationVersion: result?.serverMaxOperationVersion || 0 })
          .where(eq(schema.operationLogs.id, op.id));
      }
      entityEventEmitter.emit('operation_log_updated', this.storyId);
      return { applied: pushedOperations.length, conflicts: 0 };
    }

    for (const entry of result.applied || []) {
      if (!entry.clientOperationId) {
        continue;
      }
      await this._db!.update(schema.operationLogs)
        .set({ isSynced: true, serverOperationVersion: entry.operationVersion })
        .where(eq(schema.operationLogs.id, entry.clientOperationId));
    }

    // Conflicts come per operation, but the decision is per entity: five refused edits on the same chapter
    // are one choice for the user, not five.
    const conflictsByEntity = new Map<string, SharedSyncConflict[]>();
    for (const conflict of result.conflicts || []) {
      const key = this.entityKey(conflict.entity, conflict.entityId);
      const bucket = conflictsByEntity.get(key);
      if (bucket) {
        bucket.push(conflict);
      } else {
        conflictsByEntity.set(key, [conflict]);
      }
    }

    let autoMergedCount = 0;
    for (const [key, group] of conflictsByEntity) {
      const first = group[0];
      // Every local operation for that entity goes into the conflict, not only the one the server cited: the
      // following ones rested on the refused base.
      const relatedOps = pushedOperations.filter(
        (op) => this.entityKey(op.entityType, op.entityId) === key,
      );
      const localOperationType = relatedOps.some((op) => op.operationType === 'delete')
        ? 'delete'
        : relatedOps.some((op) => op.operationType === 'create')
          ? 'create'
          : 'update';
      const localValues =
        relatedOps.length > 0
          ? mergeLocalOperationPayloads(relatedOps)
          : first.attemptedChanges || {};

      // `version_conflict` only says the base that was read went stale, not that both sides changed the same
      // fields - `checkVersionConflict` on the server compares only the version number (see
      // `BaseSyncEntityHandler.ts`). If no field is genuinely disputed, merging silently and rebasing the
      // pending operation is the same thing `reconcileRemoteUpdate` already does on the pull path; without
      // this, editing different fields of the same character in two places always became a decision for the
      // user, with nothing to decide. Restricted to an `update` with the entity still alive on the server - a
      // deleted entity arrives with `reason: 'deleted_on_server'`, never `'version_conflict'` (checked
      // earlier, in `BaseSyncEntityHandler.update()` itself), so this never merges over a deletion.
      //
      // Important: `contestedFields` here must NOT come from `findContestedFields(localValues,
      // first.serverEntity)` as on the pull path. There, `remoteValues` is only the delta of ONE specific
      // remote operation, so comparing against `localValues` correctly answers "did the server change this
      // field too?". Here `first.serverEntity` is the whole current row - the value of a field the client
      // itself is editing always "looks" different from the new value, whether the server touched it or not,
      // which would make every edited field look disputed. `first.changedFields` (populated by the server
      // from its own operation history - see `SyncService.getChangedFieldsSinceVersion`) is the real delta:
      // the fields that changed *since the version the client read*. Without it (an old server, a response
      // without that field), there is no way to prove there is no real dispute - the safe move is not to
      // merge, and to leave it as a conflict as usual.
      if (
        first.reason === 'version_conflict' &&
        localOperationType === 'update' &&
        first.serverEntity &&
        first.changedFields
      ) {
        // A field is only genuinely disputed if (a) somebody else touched it since the client's base AND (b)
        // the value the client wants to write really does differ from what is there now - the second part is
        // what was missing: taking "changedFields" alone reconflicts whenever the final value coincides by
        // chance (both sides renaming to the same text, say), even with nothing actually to decide.
        // `findContestedFields` already does the tolerant value comparison the rest of the system uses.
        const contestedFields = findContestedFields(localValues, first.serverEntity).filter(
          (field) => first.changedFields!.includes(field),
        );
        if (contestedFields.length === 0) {
          const mergeableValues: Record<string, any> = {};
          for (const [field, value] of Object.entries(first.serverEntity)) {
            if (!contestedFields.includes(field)) {
              mergeableValues[field] = value;
            }
          }
          const table = getEntityTable(first.entity);
          if (table) {
            const columns = toEntityColumns(first.entity, mergeableValues);
            if (Object.keys(columns).length > 0) {
              await this._db!.update(table)
                .set(columns)
                .where(eq((table as any).id, first.entityId));
            }
          }
          await this.rebasePendingOperations(relatedOps, first.serverVersion);
          autoMergedCount++;
          continue;
        }
      }

      await this.conflictService.recordConflict({
        storyId: this.storyId!,
        entityType: first.entity,
        entityId: first.entityId,
        reason: first.reason,
        localOperationType,
        localOperationIds: relatedOps.map((op) => op.id),
        localValues,
        serverValues: first.serverEntity ?? null,
        clientVersion: first.clientVersion ?? null,
        serverVersion: first.serverVersion ?? null,
        message: group.map((conflict) => conflict.message).join(' | '),
      });
    }

    entityEventEmitter.emit('operation_log_updated', this.storyId);

    const appliedCount = (result.applied || []).length;
    const realConflictCount = conflictsByEntity.size - autoMergedCount;
    if (appliedCount > 0) {
      console.log(`Successfully pushed ${appliedCount} operations for story ${this.storyId}.`);
      if (!options.silent) {
        showNotification(i18n.t('sync_pushed_updates', { count: appliedCount }), 'success');
      }
    }
    if (realConflictCount > 0 && !options.silent) {
      showNotification(i18n.t('sync_conflicts_detected', { count: realConflictCount }), 'warning');
    }
    return { applied: appliedCount, conflicts: realConflictCount };
  }
}
