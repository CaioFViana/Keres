import {
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
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { OperationLogSelect, ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import { createKeresAxiosInstance, isOfflineError, KeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { getEntityTable, toEntityColumns } from './entityTableRegistry';
import { AttributeValueClientSyncHandler } from './entity-sync-handlers/AttributeValueClientSyncHandler';
import { ChapterClientSyncHandler } from './entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from './entity-sync-handlers/CharacterClientSyncHandler';
import { CharacterRelationClientSyncHandler } from './entity-sync-handlers/CharacterRelationClientSyncHandler';
import { CharacterSceneClientSyncHandler } from './entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceCheckClientSyncHandler } from './entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from './entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { ChoiceClientSyncHandler } from './entity-sync-handlers/ChoiceClientSyncHandler';
import { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import { EffectClientSyncHandler } from './entity-sync-handlers/EffectClientSyncHandler';
import { GalleryClientSyncHandler } from './entity-sync-handlers/GalleryClientSyncHandler';
import { GalleryRelationClientSyncHandler } from './entity-sync-handlers/GalleryRelationClientSyncHandler';
import { ItemClientSyncHandler } from './entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from './entity-sync-handlers/ItemJourneyClientSyncHandler';
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
import { createMediaSyncService, MediaSyncService } from './MediaSyncService';
import { createServerService } from './ServerService';
import { createStoryService } from './storymanagement/StoryService';
import { createFavoriteService } from './storymanagement/FavoriteService';
import { createCommentService } from './storymanagement/CommentService';
import {
  applyReorderToLocalDb,
  createSyncConflictService,
  findContestedFields,
  mergeLocalOperationPayloads,
  SyncConflictService,
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
  Gallery: 'gallery_changed',
  GalleryRelation: 'gallery_relation_changed',
  StorySchemaField: 'story_schema_field_changed',
  AttributeValue: 'attribute_value_changed',
  Favorite: 'favorite_changed',
  SeeAlsoRelation: 'see_also_relation_changed',
  Comment: 'comment_changed',
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
   * Guardado porque a transferência de mídia não passa pelo Axios (ver `MediaSyncService`)
   * e precisa do servidor para montar a autenticação por conta própria.
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
    this.registerEntityHandler(new SceneClientSyncHandler());
    this.registerEntityHandler(new GalleryClientSyncHandler());
    this.registerEntityHandler(new GalleryRelationClientSyncHandler());
    this.registerEntityHandler(new StorySchemaFieldClientSyncHandler());
    this.registerEntityHandler(new AttributeValueClientSyncHandler());
    this.registerEntityHandler(new FavoriteClientSyncHandler());
    this.registerEntityHandler(new SeeAlsoRelationClientSyncHandler());
    this.registerEntityHandler(new CommentClientSyncHandler());
    // TODO: Register other entity handlers here
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
    this._conflictService = null; // Recriado sob demanda, já ligado ao novo banco.
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
        wasOffline = await this.performTrackedSync();
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
    if (this.syncInFlight) {
      this.syncQueued = true;
      return;
    }
    this.syncInFlight = true;
    const run = async () => {
      do {
        this.syncQueued = false;
        await this.performTrackedSync();
      } while (this.syncQueued);
      this.syncInFlight = false;
    };
    run().catch((error) => {
      this.syncInFlight = false;
      console.log('SyncEngineService: on-demand sync failed.', error);
    });
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

    // Título só existe depois do download; até lá a notificação de erro cai no id mesmo.
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
   * Envia uma história totalmente local (`serverId` nulo) para um servidor pela primeira vez.
   *
   * Checa a existência direto no servidor (não via `fetchServerStoryPreviews`, que engole
   * erros de rede e devolveria `[]` - o que pareceria "não existe" mesmo quando a checagem só
   * falhou por estar offline) antes de exportar e enviar via `POST /stories/import?storyId=`,
   * preservando o ID local. A checagem do lado da API (`StoryExportImportService.importStory`,
   * escopada por id+usuário) é o backstop caso duas chamadas corram ao mesmo tempo.
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

    // O servidor agora tem exatamente o que o op-log local tinha no momento do export - é essa
    // a base correta pro próximo ciclo de sync, não o `serverLastOperationVersion` do pacote
    // exportado (que reflete um vínculo anterior, sempre 0 pra uma história nunca vinculada).
    await createFavoriteService(this._db).migrateUserIdentity(storyId, userId, server.idUser);
    await createCommentService(this._db).migrateAuthorIdentity(storyId, userId, server.idUser);
    // Essas operações já estão representadas pelo snapshot importado. Reenviá-las carregaria
    // a antiga identidade local, que não existe no servidor, e duplicaria o comentário.
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
   * Versão em que o usuário se apoiou ao fazer a edição.
   *
   * Todos os services locais incrementam `version` em exatamente 1 e gravam no payload da
   * operação a versão *resultante*. O servidor precisa da base, não do resultado: é
   * comparando a base com a versão que ele tem agora que se descobre se alguém escreveu no
   * meio. Mandar o resultado (como era feito antes) fazia a checagem passar sempre.
   */
  private deriveBaseVersion(payload: Record<string, any>): number | undefined {
    const resultingVersion = payload?.version;
    if (typeof resultingVersion !== 'number' || resultingVersion < 1) {
      return undefined;
    }
    return resultingVersion - 1;
  }

  /** Chave de agrupamento de operações e conflitos por entidade. */
  private entityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
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

      // 2. Pull remote updates first (since the latest known server version)
      console.log(
        `Pulling remote updates for story ${this.storyId} since version ${lastSyncedLog}...`,
      );
      const pullResponse = await this.client.get<{
        updates: StoryUpdate[];
        publicFavorites?: Favorite[];
        serverMaxOperationVersion: number;
        role: 'owner' | 'writer' | 'reader';
      }>(
        `/sync/${this.storyId}/pull?lastOperationVersion=${lastSyncedLog}&lastPublicFavoriteVersion=${lastPublicFavoriteLog}`,
      );
      const { updates: remoteUpdates, publicFavorites = [], role: myRole } = pullResponse.data;

      /**
       * Avançamos o marcador apenas até a operação mais alta que realmente chegou, e não
       * até o `serverMaxOperationVersion` da resposta. Os dois são lidos em consultas
       * separadas no servidor: uma operação gravada entre elas entra no máximo mas não na
       * lista, e confiar no máximo a puliria para sempre.
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

        // Operações locais ainda não aceitas pelo servidor, indexadas por entidade. É com
        // elas que as atualizações remotas podem colidir: aplicar a versão remota em cima
        // apagaria em silêncio o que o usuário escreveu offline.
        const pendingByEntity = await this.getPendingOperationsByEntity();
        let conflictsDetected = 0;

        for (const update of remoteUpdates) {
          const handler = this.entityHandlers.get(update.entity);
          if (!handler) {
            console.log(`No client sync handler registered for entity type: ${update.entity}`);
            continue;
          }

          // Operação que este próprio cliente enviou e o servidor está devolvendo. Já está
          // aplicada aqui; reaplicá-la só duplicaria a linha no log local.
          if (await this.isOwnEchoedOperation(update)) {
            markRemoteOperationApplied(update);
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
              await this.recordRemoteOperationLocally(update);
              markRemoteOperationApplied(update);
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
                continue;
              }

              await applyReorderToLocalDb(this._db, reorderUpdate, new Date(update.operationTime!));
            }
            markEntityUpdated(update.entity, update.id);

            await this.recordRemoteOperationLocally(update);
            markRemoteOperationApplied(update);
          } catch (handlerError) {
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

      // O snapshot público é a fonte autoritativa para favoritos dos colaboradores.
      // Ele fecha lacunas deixadas por histórias importadas sem logs antigos e por cursores
      // de clientes que já tinham avançado antes de a visibilidade pública ser ativada.
      // O servidor exclui as linhas do usuário atual para não sobrescrever uma alteração
      // local dele que ainda será enviada na etapa seguinte deste mesmo ciclo.
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
            {
              type: 'create',
              entity: 'Favorite',
              id: favorite.id,
              data: favorite,
              version: favorite.version,
            } as CreateStoryUpdate,
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

      // 3. Fetch pending local operations (after applying remote updates to bring local DB up to date)
      const pendingLocalOperations = await this.getPushableOperations();

      // 4. Push local updates to server
      if (pendingLocalOperations.length > 0) {
        console.log(
          `Pushing ${pendingLocalOperations.length} local operations for story ${this.storyId} to server...`,
        );
        try {
          const updatesToPush: StoryUpdate[] = pendingLocalOperations
            .map((op) => {
              const payloadData = JSON.parse(op.payload);

              const baseUpdate: Omit<StoryUpdate, 'type'> = {
                entity: op.entityType,
                id: op.entityId,
                // Base sobre a qual o usuário editou. O servidor compara com a versão que ele
                // tem para decidir se aceita ou se devolve conflito.
                version: this.deriveBaseVersion(payloadData),
                operationTime: op.createdAt.toISOString(),
                // Devolvido intacto na resposta, para sabermos exatamente quais operações
                // passaram e quais foram recusadas.
                clientOperationId: op.id,
              };

              // Remove client-generated timestamp fields that should be server-managed
              const filteredPayloadData: Record<string, any> = { ...payloadData };
              delete filteredPayloadData.createdAt;
              delete filteredPayloadData.updatedAt;
              delete filteredPayloadData.deletedAt;
              delete filteredPayloadData.storyId; // Remove storyId if it somehow got into payloadData

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
                      // O servidor lê a base de `changes.version` para operações de update.
                      version: baseUpdate.version,
                    },
                  } as UpdateStoryUpdate;
                case 'delete':
                  return {
                    ...baseUpdate,
                    type: 'delete',
                  } as DeleteStoryUpdate;
                case 'reorder':
                  if (
                    op.entityType === 'Chapter' &&
                    Array.isArray(filteredPayloadData.reorderItems)
                  ) {
                    return {
                      ...baseUpdate,
                      type: 'reorder',
                      entity: 'Chapter',
                      reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({
                        ...item,
                      })),
                    } as ChapterReorderingStoryUpdate;
                  } else if (
                    op.entityType === 'Story' &&
                    Array.isArray(filteredPayloadData.reorderItems)
                  ) {
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
            })
            .filter(Boolean) as StoryUpdate[];

          const pushResponse = await this.client.post<SyncPushResult>(
            `/sync/${this.storyId}`,
            updatesToPush,
          );
          await this.applyPushResult(pushResponse.data, pendingLocalOperations);
        } catch (pushError: any) {
          if (isOfflineError(pushError)) {
            // Server unreachable: the operations stay unsynced and will be retried
            // on the next cycle. Nothing for the user to act on.
            console.log(`Push skipped for story ${this.storyId}: server unreachable.`);
            return true;
          }
          console.log(
            `Error pushing local operations for story ${this.storyId}:`,
            pushError?.message || pushError,
          );
          showNotification(i18n.t('sync_push_failed'), 'error');
        }
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

      // 6. Reconcile media files. Roda depois dos metadados de propósito: uma mídia só
      // pode ser baixada depois que a linha que a descreve chegou, e só pode ser enviada
      // depois que o servidor aceitou essa mesma linha.
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
   * Sobe e baixa os arquivos da galeria. Resolve para `true` se o servidor estiver
   * inacessível, para o ciclo tratar como offline.
   *
   * Uma falha aqui nunca derruba a sincronização: mídia que não transferiu continua
   * marcada como pendente e é tentada de novo no ciclo seguinte, enquanto o texto da
   * história segue sincronizando normalmente.
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
   * Operações locais que podem ir para o servidor: ainda não sincronizadas e sem conflito
   * pendente. Excluir as conflitadas é o que impede o ciclo de reenviar para sempre uma
   * operação que o servidor já recusou.
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

  /** Operações locais pendentes agrupadas por entidade, para cruzar com o que vem do pull. */
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
   * A operação que veio do pull já está registrada localmente?
   *
   * Cobre dois casos: operações que este cliente empurrou e o servidor está devolvendo, e
   * operações remotas que um pull anterior já aplicou. Nos dois, reaplicar é desnecessário
   * e duplicaria a linha no log local.
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
   * Aplica uma criação remota tolerando que a entidade já exista.
   *
   * Um `insert` cru falharia ao repetir a operação (por exemplo se a resposta de um push
   * anterior se perdeu e o servidor devolveu a criação no pull seguinte), e a falha era
   * contabilizada como "erro ao aplicar atualização remota" sem nada de errado ter
   * acontecido de fato.
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
      changes: createUpdate.data,
    } as UpdateStoryUpdate);
  }

  /**
   * Registra no log local uma operação vinda do servidor.
   *
   * O id usado é o da operação *no servidor*. Antes usava-se o id da entidade, o que fazia
   * a segunda operação sobre a mesma entidade colidir na chave primária - a falha era
   * engolida e reportada ao usuário como "falha ao aplicar atualizações remotas".
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
   * Reconcilia uma atualização remota com edições locais ainda não aceitas na mesma entidade.
   *
   * A regra é preservar o que a pessoa fez: campos que só o servidor mudou são aplicados,
   * campos que a pessoa também mudou ficam com o valor dela e viram um conflito para ela
   * decidir. Antes, a atualização remota era escrita por cima e a edição offline
   * desaparecia sem aviso.
   */
  private async reconcileRemoteUpdate(
    update: StoryUpdate,
    pendingLocalOps: OperationLogSelect[],
    handler: ClientSyncEntityHandler,
  ): Promise<{ conflicted: boolean }> {
    const entityId = update.id!;

    // Reorder não cabe no resto desta função: o valor em disputa é a ordem inteira
    // (`reorderItems`), não campos escalares de uma entidade - `mergeLocalOperationPayloads`/
    // `findContestedFields` não fazem sentido pra ele.
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
        // Os dois lados excluíram: mesma intenção, nada a decidir.
        await handler.applyDelete(this.storyId!, update as DeleteStoryUpdate);
        return { conflicted: false };
      }
      // A exclusão remota não é aplicada de propósito: descartar aqui o que a pessoa
      // escreveu tiraria dela a chance de recuperar a entidade.
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
      // As duas edições cabem juntas. A local só precisa ser reapoiada na versão nova,
      // e assim ela passa no próximo push sem incomodar o usuário com uma decisão.
      await this.rebasePendingOperations(pendingLocalOps, update.version);
      return { conflicted: false };
    }

    await recordConflict('concurrent_edit', remoteValues);
    return { conflicted: true };
  }

  /**
   * Contraparte de `reconcileRemoteUpdate` só para reorder - extraída à parte porque o
   * valor em disputa (`reorderItems`) não é um conjunto de campos de uma entidade, é a
   * ordem inteira de N outras linhas (Scenes de um Chapter, ou Chapters de uma Story).
   */
  private async reconcileRemoteReorder(
    update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
    entityId: string,
    pendingLocalOps: OperationLogSelect[],
  ): Promise<{ conflicted: boolean }> {
    const localReorderOp = pendingLocalOps.find((op) => op.operationType === 'reorder');

    if (!localReorderOp) {
      // O que está pendente nesta entidade é de outro tipo (ex.: renomear um capítulo) - não
      // conflita com a ordem vinda do servidor, que pode ser aplicada direto.
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
   * Reescreve a base das operações locais pendentes para a versão que a entidade tem
   * agora, encadeando-as (a primeira apoia na versão nova, a segunda na seguinte, e assim
   * por diante) para que o servidor as aceite em sequência.
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
      // O motor deriva a base como `payload.version - 1`, então gravamos base + 1.
      payload.version = base + 1;
      await this._db!.update(schema.operationLogs)
        .set({ payload: JSON.stringify(payload) })
        .where(eq(schema.operationLogs.id, op.id));
      base += 1;
    }
  }

  /**
   * Processa a resposta do push: marca como sincronizadas só as operações que o servidor
   * aceitou e transforma as recusadas em conflitos pendentes.
   *
   * Antes, qualquer resposta 2xx marcava *todas* as operações como sincronizadas, então uma
   * operação recusada era descartada em silêncio - a edição do usuário simplesmente
   * desaparecia.
   */
  private async applyPushResult(
    result: SyncPushResult,
    pushedOperations: OperationLogSelect[],
  ): Promise<void> {
    const { showNotification } = useNotificationStore.getState();

    if (!Array.isArray(result?.applied) && !Array.isArray(result?.conflicts)) {
      // Servidor anterior a esta mudança: não há resultado por operação para inspecionar.
      // Mantemos o comportamento antigo em vez de deixar de sincronizar com ele.
      console.log(
        'SyncEngineService: server did not report per-operation results, assuming the whole batch was applied.',
      );
      for (const op of pushedOperations) {
        await this._db!.update(schema.operationLogs)
          .set({ isSynced: true, serverOperationVersion: result?.serverMaxOperationVersion || 0 })
          .where(eq(schema.operationLogs.id, op.id));
      }
      entityEventEmitter.emit('operation_log_updated', this.storyId);
      return;
    }

    for (const entry of result.applied || []) {
      if (!entry.clientOperationId) {
        continue;
      }
      await this._db!.update(schema.operationLogs)
        .set({ isSynced: true, serverOperationVersion: entry.operationVersion })
        .where(eq(schema.operationLogs.id, entry.clientOperationId));
    }

    // Conflitos vêm por operação, mas a decisão é por entidade: cinco edições recusadas no
    // mesmo capítulo são uma escolha do usuário, não cinco.
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
      // Todas as operações locais daquela entidade entram no conflito, e não só a que o
      // servidor citou: as seguintes se apoiavam na base recusada.
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

      // `version_conflict` só diz que a base lida ficou velha, não que os dois lados
      // mudaram os mesmos campos - `checkVersionConflict` no servidor compara só o número
      // da versão (ver `BaseSyncEntityHandler.ts`). Se nenhum campo realmente disputa,
      // mesclar em silêncio e reapoiar a operação pendente é o mesmo que `reconcileRemoteUpdate`
      // já faz no caminho de pull; sem isto, editar campos diferentes do mesmo personagem em
      // dois lugares sempre virava uma decisão do usuário, mesmo sem nada pra decidir. Restrito
      // a `update` com a entidade ainda viva no servidor - uma entidade excluída chega com
      // `reason: 'deleted_on_server'`, nunca `'version_conflict'` (checado antes, na própria
      // `BaseSyncEntityHandler.update()`), então isto nunca mescla por cima de uma exclusão.
      //
      // Importante: `contestedFields` aqui NÃO pode vir de `findContestedFields(localValues,
      // first.serverEntity)` como no caminho de pull. Lá `remoteValues` é só o delta de UMA
      // operação remota específica, então comparar contra `localValues` responde "o servidor
      // mudou este campo também?" corretamente. Aqui `first.serverEntity` é a linha inteira
      // atual - o valor de um campo que o próprio cliente está editando sempre "parece"
      // diferente do valor novo, tenha o servidor mexido nele ou não, o que faria todo campo
      // editado parecer disputado. `first.changedFields` (populado pelo servidor a partir do
      // seu próprio histórico de operações - ver `SyncService.getChangedFieldsSinceVersion`)
      // é o delta de verdade: os campos que mudaram *desde a versão que o cliente leu*. Sem
      // ele (servidor antigo, resposta sem esse campo), não há como provar que não há
      // disputa real - o seguro é não mesclar, e deixar como conflito de sempre.
      if (
        first.reason === 'version_conflict' &&
        localOperationType === 'update' &&
        first.serverEntity &&
        first.changedFields
      ) {
        // Um campo só é genuinamente disputado se (a) alguém mais mexeu nele desde a base do
        // cliente E (b) o valor que o cliente quer escrever realmente diverge do que está lá
        // agora - a segunda parte é o que faltava: pegar "changedFields" sozinho reconflita
        // sempre que o valor final coincide por acaso (ex.: os dois lados renomearam pra o
        // mesmo texto), mesmo não havendo nada de fato pra decidir. `findContestedFields` já
        // faz a comparação de valor tolerante que o resto do sistema usa.
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
    if (appliedCount > 0) {
      console.log(`Successfully pushed ${appliedCount} operations for story ${this.storyId}.`);
      showNotification(i18n.t('sync_pushed_updates', { count: appliedCount }), 'success');
    }
    const realConflictCount = conflictsByEntity.size - autoMergedCount;
    if (realConflictCount > 0) {
      showNotification(i18n.t('sync_conflicts_detected', { count: realConflictCount }), 'warning');
    }
  }
}
