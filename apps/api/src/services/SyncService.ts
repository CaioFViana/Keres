import { ChapterReorderingStoryUpdate, CreateStoryUpdate, DeleteStoryUpdate, EffectiveStoryRole, StoryReorderingStoryUpdate, StoryUpdate, SyncAppliedOperation, SyncConflict, UpdateStoryUpdate } from '@keres/shared';
import { and, eq, gt, max, ne, or, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { db } from '../db';
import { favorites, operationLog, operationTypeEnum, stories, storyPermissions } from '../db/schema';
import { eventManager } from '../utils/EventManager'; // Import eventManager
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { SyncConflictError, SyncEntityHandler } from './entity-sync-handlers/BaseSyncEntityHandler';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';
import { AttributeValueSyncHandler } from './entity-sync-handlers/AttributeValueSyncHandler';
import { ChapterSyncHandler } from './entity-sync-handlers/ChapterSyncHandler';
import { CharacterRelationSyncHandler } from './entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSceneSyncHandler } from './entity-sync-handlers/CharacterSceneSyncHandler';
import { CharacterSyncHandler } from './entity-sync-handlers/CharacterSyncHandler';
import { ChoiceSyncHandler } from './entity-sync-handlers/ChoiceSyncHandler';
import { GalleryRelationSyncHandler } from './entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from './entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from './entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from './entity-sync-handlers/ItemSyncHandler';
import { LocationRelationSyncHandler } from './entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from './entity-sync-handlers/LocationSyncHandler';
import { NoteRelationSyncHandler } from './entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from './entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from './entity-sync-handlers/SceneSyncHandler';
import { StorySchemaFieldSyncHandler } from './entity-sync-handlers/StorySchemaFieldSyncHandler';
import { StorySyncHandler } from './entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from './entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from './entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from './entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from './entity-sync-handlers/WorldRuleSyncHandler';
import { FavoriteSyncHandler } from './entity-sync-handlers/FavoriteSyncHandler';
import { SeeAlsoRelationSyncHandler } from './entity-sync-handlers/SeeAlsoRelationSyncHandler';
import { CommentSyncHandler } from './entity-sync-handlers/CommentSyncHandler';
import { storyPermissionService } from './StoryPermissionService';

export class SyncService {
  private entityHandlers: Map<string, SyncEntityHandler>;

  constructor() {
    this.entityHandlers = new Map<string, SyncEntityHandler>();
    this.registerEntityHandler(new StorySyncHandler());
    this.registerEntityHandler(new CharacterSyncHandler());
    this.registerEntityHandler(new ChapterSyncHandler());
    this.registerEntityHandler(new LocationSyncHandler());
    this.registerEntityHandler(new SceneSyncHandler());
    this.registerEntityHandler(new GallerySyncHandler());
    this.registerEntityHandler(new GalleryRelationSyncHandler());
    this.registerEntityHandler(new NoteSyncHandler());
    this.registerEntityHandler(new WorldRuleSyncHandler());
    this.registerEntityHandler(new ChoiceSyncHandler());
    this.registerEntityHandler(new CharacterSceneSyncHandler());
    this.registerEntityHandler(new CharacterRelationSyncHandler());
    this.registerEntityHandler(new ItemSyncHandler());
    this.registerEntityHandler(new ItemJourneySyncHandler());
    this.registerEntityHandler(new SuggestionSyncHandler());
    this.registerEntityHandler(new TagSyncHandler());
    this.registerEntityHandler(new TagRelationSyncHandler());
    this.registerEntityHandler(new NoteRelationSyncHandler());
    this.registerEntityHandler(new StorySchemaFieldSyncHandler());
    this.registerEntityHandler(new AttributeValueSyncHandler());
    this.registerEntityHandler(new LocationRelationSyncHandler());
    this.registerEntityHandler(new FavoriteSyncHandler());
    this.registerEntityHandler(new SeeAlsoRelationSyncHandler());
    this.registerEntityHandler(new CommentSyncHandler());
  }

  private registerEntityHandler(handler: SyncEntityHandler) {
    this.entityHandlers.set(handler.entityName, handler);
  }

  /** Exposto para AdminRecoveryService (restaurar entidades) e TierEnforcementService (contar uso). */
  getEntityHandlers(): ReadonlyMap<string, SyncEntityHandler> {
    return this.entityHandlers;
  }

  /**
   * Aplica um lote de operações vindas de um cliente, uma a uma.
   *
   * O lote deliberadamente *não* é tudo-ou-nada. Antes, a primeira operação recusada
   * lançava e abortava o resto - mas as operações anteriores já tinham sido escritas nas
   * tabelas de entidade e o log de operações só era gravado no fim, então o lote quebrado
   * deixava o servidor com dados que nenhum outro cliente jamais veria. Agora cada
   * operação é aplicada e registrada individualmente, e as recusadas voltam descritas em
   * `conflicts` para o cliente resolver com o usuário.
   */
  async processAndRecordUpdates(userId: string, storyId: string, updates: StoryUpdate[]): Promise<{
    lastOperationVersion: number;
    applied: SyncAppliedOperation[];
    conflicts: SyncConflict[];
  }> {
    // Authorization check
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error('Story not found.');
    }

    let role: EffectiveStoryRole | undefined;
    if (story.userId === userId) {
      role = 'owner';
    } else {
      const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
      if (permission && (permission.permissionType === 'writer' || permission.permissionType === 'reader')) {
        role = permission.permissionType;
      }
    }

    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have access to this story.');
    }

    const applied: SyncAppliedOperation[] = [];
    const conflicts: SyncConflict[] = [];
    /**
     * Entidades que já conflitaram neste lote. As operações seguintes sobre elas foram
     * construídas em cima de uma base que acabamos de recusar, então aplicá-las
     * corromperia o estado - são recusadas junto, e a tela de conflito trata a entidade
     * como um caso único.
     */
    const blockedEntities = new Set<string>();

    let lastOperationVersion = await this.getMaxOperationVersion(storyId);

    for (const update of updates) {
      const entityId = update.id || '';
      const entityKey = `${update.entity}:${entityId}`;

      const recordConflict = (
        reason: SyncConflict['reason'],
        message: string,
        extra?: Partial<SyncConflict>
      ) => {
        blockedEntities.add(entityKey);
        conflicts.push({
          clientOperationId: update.clientOperationId,
          entity: update.entity,
          entityId,
          type: update.type,
          reason,
          message,
          ...extra,
        });
      };

      const handler = this.entityHandlers.get(update.entity);
      if (!handler) {
        recordConflict('unknown', `No sync handler registered for entity type: ${update.entity}`);
        continue;
      }

      // Personal favorites are user-owned metadata, so readers may change their own rows
      // without gaining permission to edit the story itself. Comments are similar in spirit
      // but opt-in per story (`story.allowReaderComments`, only meaningful/shown for
      // server-linked stories) - when off, this check locks a reader out of create/update/
      // delete uniformly, including comments they already posted while it was on.
      const readerCanWriteEntity = update.entity === 'Favorite'
        || (update.entity === 'Comment' && story.allowReaderComments);
      if (role === 'reader' && !readerCanWriteEntity) {
        recordConflict('unauthorized', 'Reader access only permits personal favorite changes' + (story.allowReaderComments ? ' or comments.' : '.'));
        continue;
      }

      if (blockedEntities.has(entityKey)) {
        recordConflict('version_conflict', `Skipped: an earlier operation on ${entityKey} in this batch conflicted.`);
        continue;
      }

      let currentEntity: any;
      try {
        currentEntity = await handler.findById(entityId);
      } catch (error) {
        recordConflict('unknown', `Failed to load ${entityKey}: ${(error as Error)?.message}`);
        continue;
      }

      // Check if the entity belongs to the story (if applicable)
      if (currentEntity && !handler.checkBelongsToStory(currentEntity, storyId)) {
        recordConflict('unauthorized', `Entity ${entityId} does not belong to story ${storyId}.`);
        continue;
      }

      /** Contexto que a tela de conflito usa para montar o comparativo lado a lado. */
      const conflictContext = (): Partial<SyncConflict> => ({
        serverEntity: currentEntity ? this.serializeEntity(currentEntity) : null,
        attemptedChanges: update.type === 'create'
          ? (update as CreateStoryUpdate).data
          : update.type === 'update'
            ? (update as UpdateStoryUpdate).changes
            : undefined,
        serverVersion: currentEntity?.version,
        clientVersion: update.type === 'update' ? (update as UpdateStoryUpdate).changes?.version : update.version,
      });

      /** Já estava aplicada: nada a escrever, mas o cliente precisa saber que passou. */
      let alreadyApplied = false;

      try {
        if (update.type === 'create') {
          if (currentEntity) {
            // Reenvio idempotente: o push anterior chegou, só a resposta se perdeu.
            // Recriar daria erro de chave duplicada e travaria o cliente para sempre.
            alreadyApplied = true;
          } else {
            if (update.entity === 'Story') {
              await tierEnforcementService.assertCanCreateStory(userId);
            } else if (update.entity !== 'Favorite' && update.entity !== 'Comment') {
              // Comments são anotações, não conteúdo da história - não devem consumir nem
              // ser bloqueados pelo limite de entidades do tier, mesmo padrão de Favorite.
              await tierEnforcementService.assertCanCreateEntity(userId, storyId);
            }
            await handler.create(userId, storyId, update as CreateStoryUpdate);
          }
        } else if (update.type === 'update' || update.type === 'reorder') {
          if (!currentEntity) {
            recordConflict('not_found', `${update.entity} with ID ${entityId} does not exist on the server.`, conflictContext());
            continue;
          }
          await handler.update(userId, storyId, update as UpdateStoryUpdate, currentEntity);
        } else if (update.type === 'delete') {
          if (!currentEntity) {
            // Excluir algo que o servidor não tem é o resultado desejado, não um erro.
            alreadyApplied = true;
          } else {
            // Comentário: o dono da história pode excluir qualquer comentário (moderação);
            // escritor/leitor só o próprio - mesmo com acesso de leitura a comentários
            // desligado depois, o autor original (se writer/reader) só perde a capacidade de
            // excluir o próprio; o dono sempre pode. Verificado aqui, não em
            // CommentSyncHandler, porque `role` só está disponível nesta função.
            if (update.entity === 'Comment' && role !== 'owner' && currentEntity.authorUserId !== userId) {
              recordConflict('unauthorized', 'Only the comment author or the story owner can delete this comment.');
              continue;
            }
            await handler.delete(userId, storyId, update as DeleteStoryUpdate, currentEntity);
          }
        }
      } catch (error) {
        if (error instanceof TierLimitExceededError) {
          recordConflict('limit_exceeded', error.message, conflictContext());
          continue;
        }
        if (error instanceof SyncConflictError) {
          recordConflict(error.reason, error.message, {
            ...conflictContext(),
            clientVersion: error.clientVersion ?? conflictContext().clientVersion,
            serverVersion: error.serverVersion ?? conflictContext().serverVersion,
          });
          continue;
        }
        if (error instanceof z.ZodError) {
          recordConflict('validation', `Invalid payload for ${entityKey}: ${error.message}`, conflictContext());
          continue;
        }
        // Falha inesperada ao aplicar esta operação. Registrada como conflito em vez de
        // derrubar o lote: as outras operações do usuário ainda podem ser salvas, e o
        // cliente para de reenviar em loop uma operação que nunca vai passar.
        logger.error(`SyncService: failed to apply ${update.type} on ${entityKey}`, error);
        recordConflict('unknown', `Failed to apply ${update.type} on ${entityKey}: ${(error as Error)?.message}`, conflictContext());
        continue;
      }

      if (alreadyApplied) {
        applied.push({
          clientOperationId: update.clientOperationId,
          operationVersion: lastOperationVersion,
          entityVersion: currentEntity?.version,
          entity: update.entity,
          entityId,
        });
        continue;
      }

      // Versão da entidade *depois* da operação, lida de volta para que o cliente saiba
      // sobre qual base as próximas edições dele se apoiam.
      const entityAfter = await handler.findById(entityId).catch(() => undefined);

      // O log é gravado imediatamente após a escrita da entidade, e não em bloco no fim:
      // se algo falhar mais adiante no lote, as operações já aplicadas continuam
      // visíveis para os outros clientes.
      const logged = await this.appendOperationLog({
        storyId,
        userId,
        update,
        entityId,
        entityVersion: entityAfter?.version,
      });

      lastOperationVersion = logged.operationVersion;
      applied.push({
        clientOperationId: update.clientOperationId,
        operationId: logged.id,
        operationVersion: logged.operationVersion,
        entityVersion: entityAfter?.version,
        entity: update.entity,
        entityId,
      });
    }

    if (applied.length > 0) {
      // Broadcast the updates to WebSocket clients subscribed to this storyId
      eventManager.emit(`storyUpdate:${storyId}`, {
        type: 'story_update',
        storyId: storyId,
        updates: applied.length,
        maxOperationVersion: lastOperationVersion,
        originatingUser: userId,
      });
    }

    return { lastOperationVersion, applied, conflicts };
  }

  private async getMaxOperationVersion(storyId: string): Promise<number> {
    const result = await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId));
    return result.at(0)?.maxVersion || 0;
  }

  /**
   * Histórias enviadas ao servidor como snapshot podem já conter favoritos. Essas linhas
   * não passaram pelo SyncService e, portanto, não possuem uma operação que os outros
   * colaboradores possam receber. Ao tornar os favoritos públicos, materializamos uma
   * operação de criação para cada linha ainda sem histórico.
   *
   * O bloqueio da Story serializa dois pulls que tentem fazer a reparação ao mesmo tempo.
   * O id do log continua sendo um ULID normal; a detecção é feita pelo id da entidade.
   */
  private async ensurePublicFavoriteOperationLogs(storyId: string): Promise<{ count: number; maxOperationVersion: number }> {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select ${stories.id} from ${stories} where ${stories.id} = ${storyId} for update`);

      const [favoriteRows, loggedFavoriteRows, maxVersionRows] = await Promise.all([
        tx.select().from(favorites).where(and(
          eq(favorites.storyId, storyId),
          eq(favorites.isDeleted, false),
        )),
        tx.select({ entityId: operationLog.entityId }).from(operationLog).where(and(
          eq(operationLog.storyId, storyId),
          eq(operationLog.entityType, 'Favorite'),
          eq(operationLog.operationType, 'create'),
        )),
        tx.select({ maxVersion: max(operationLog.operationVersion) })
          .from(operationLog)
          .where(eq(operationLog.storyId, storyId)),
      ]);

      const loggedIds = new Set(loggedFavoriteRows.map((row) => row.entityId));
      const missingFavorites = favoriteRows.filter((favorite) => !loggedIds.has(favorite.id));
      let nextOperationVersion = maxVersionRows.at(0)?.maxVersion || 0;

      for (const favorite of missingFavorites) {
        nextOperationVersion += 1;
        await tx.insert(operationLog).values({
          id: ulid(),
          storyId,
          userId: favorite.userId,
          operationVersion: nextOperationVersion,
          operationType: 'create',
          entityType: 'Favorite',
          entityId: favorite.id,
          payload: {
            entityId: favorite.entityId,
            entityType: favorite.entityType,
            userId: favorite.userId,
          },
          entityVersion: favorite.version,
          createdAt: favorite.createdAt,
        });
      }

      return { count: missingFavorites.length, maxOperationVersion: nextOperationVersion };
    });
  }

  /**
   * Grava uma operação no log já com o próximo `operationVersion` da história.
   *
   * A numeração é calculada dentro do próprio INSERT em vez de lida antes em JavaScript,
   * para que dois pushes concorrentes na mesma história não recebam o mesmo número (o que
   * faria um dos dois ficar invisível para os pulls dos outros clientes).
   *
   * Pública para que AdminRecoveryService possa registrar uma restauração feita pelo
   * painel administrativo com a mesma lógica de numeração, em vez de duplicá-la.
   */
  async appendOperationLog(args: {
    storyId: string;
    userId: string;
    update: StoryUpdate;
    entityId: string;
    entityVersion?: number;
  }): Promise<{ id: string; operationVersion: number }> {
    const { storyId, userId, update, entityId, entityVersion } = args;

    let payload: Record<string, any> = {};
    if (update.type === 'create') {
      payload = (update as CreateStoryUpdate).data;
    } else if (update.type === 'update') {
      payload = (update as UpdateStoryUpdate).changes;
    } else if (update.type === 'delete') {
      payload = { id: entityId }; // For delete, store the ID of the deleted entity
    } else if (update.type === 'reorder') {
      // Sem isto o pull devolve um reorder sem `reorderItems` e o cliente não tem o que aplicar.
      payload = { reorderItems: (update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate).reorderItems };
    }

    const id = ulid();
    const inserted = await db.insert(operationLog).values({
      id,
      storyId,
      userId,
      operationVersion: sql<number>`coalesce((select max(existing.operation_version) from operation_log existing where existing.story_id = ${storyId}), 0) + 1`,
      operationType: operationTypeEnum.enumValues.includes(update.type as any) ? update.type as any : 'update',
      entityType: update.entity,
      entityId: entityId || ulid(),
      payload,
      entityVersion: entityVersion ?? null,
      createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
    }).returning({ operationVersion: operationLog.operationVersion });

    return { id, operationVersion: inserted.at(0)?.operationVersion ?? 0 };
  }

  /** Converte Dates em ISO para que a entidade atravesse o JSON da resposta intacta. */
  private serializeEntity(entity: Record<string, any>): Record<string, any> {
    const serialized: Record<string, any> = {};
    for (const [key, value] of Object.entries(entity)) {
      serialized[key] = value instanceof Date ? value.toISOString() : value;
    }
    return serialized;
  }

  async getUpdatesForStory(
    userId: string,
    storyId: string,
    lastOperationVersion: number,
    lastPublicFavoriteVersion: number = 0,
  ): Promise<{ updates: StoryUpdate[]; publicFavorites: typeof favorites.$inferSelect[]; serverMaxOperationVersion: number; role: EffectiveStoryRole }> {
    // Authorization check
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error('Story not found.');
    }

    let role: EffectiveStoryRole | undefined;
    if (story.userId === userId) {
      role = 'owner';
    } else {
      const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
      if (permission && (permission.permissionType === 'reader' || permission.permissionType === 'writer')) {
        role = permission.permissionType;
      }
    }

    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have read permission for this story.');
    }

    if (story.favoriteBehavior === 'individual_public') {
      const repairedFavorites = await this.ensurePublicFavoriteOperationLogs(storyId);
      if (repairedFavorites.count > 0) {
        logger.info('Created missing operation logs for public favorites', {
          storyId,
          count: repairedFavorites.count,
        });
        eventManager.emit(`storyUpdate:${storyId}`, {
          type: 'story_update',
          storyId,
          updates: repairedFavorites.count,
          maxOperationVersion: repairedFavorites.maxOperationVersion,
        });
      }
    }

    const operationsAfterMainCursor = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        gt(operationLog.operationVersion, lastOperationVersion)
      ),
      orderBy: [operationLog.operationVersion],
    });

    const visibleOperations = operationsAfterMainCursor.filter((op) => (
      op.entityType !== 'Favorite'
      || story.favoriteBehavior === 'individual_public'
      || op.userId === userId
    ));

    // Um cursor próprio permite publicar também favoritos anteriores à troca de comportamento.
    // O Map remove a sobreposição natural com a consulta principal quando ambos os cursores
    // ainda estão próximos.
    const historicalPublicFavorites = story.favoriteBehavior === 'individual_public'
      ? await db.query.operationLog.findMany({
          where: and(
            eq(operationLog.storyId, storyId),
            eq(operationLog.entityType, 'Favorite'),
            gt(operationLog.operationVersion, lastPublicFavoriteVersion),
          ),
          orderBy: [operationLog.operationVersion],
        })
      : [];
    const fetchedOperations = Array.from(
      new Map([...visibleOperations, ...historicalPublicFavorites].map((operation) => [operation.id, operation])).values(),
    ).sort((a, b) => a.operationVersion - b.operationVersion);

    const updates: StoryUpdate[] = await Promise.all(fetchedOperations.map(async op => {
      const payloadAsRecord = op.payload as Record<string, any>; // Client's original payload

      let finalData: Record<string, any> | undefined;
      let finalChanges: Record<string, any> | undefined;
      let finalVersion: number | undefined;
      let operationTime: Date | undefined;

      // Determine the operation time based on the type
      // op.createdAt is a Date object from the DB.
      // update.operationTime is a string (if available from incoming client update).
      // For returned StoryUpdate, operationTime should be a string as per user's instruction.

      operationTime = op.createdAt; // Start with Date object from DB

      /**
       * A versão da *entidade* após esta operação. `operationVersion` é a posição da
       * operação na sequência da história - um número muito maior - e mandá-lo no lugar
       * inflava a versão que o cliente guarda, fazendo toda checagem de conflito passar.
       *
       * Linhas gravadas antes da coluna `entityVersion` existir não têm o dado; para elas
       * o comportamento antigo é mantido, porque não há de onde tirar o valor correto.
       */
      const resultingEntityVersion = op.entityVersion ?? op.operationVersion;

      // --- Enrich data based on operation type ---
      if (op.operationType === 'create') {
        // For 'create', the client original payload contains the base data.
        // We need to add the generated fields from the operationLog.
        finalData = {
          ...payloadAsRecord, // Original client data
          createdAt: op.createdAt.toISOString(), // Convert to string for client
          updatedAt: op.createdAt.toISOString(), // For create, updatedAt is same as createdAt, convert to string
          version: resultingEntityVersion, // Versão da entidade após a criação
          isDeleted: false,
          deletedAt: null,
        };
        // Explicitly remove storyId if it was somehow in payloadAsRecord
        delete finalData.storyId;
        finalVersion = resultingEntityVersion;
      } else if (op.operationType === 'update') {
        // For 'update', the changes are directly from the payload.
        // We need to add the generated fields from the operationLog.
        finalChanges = {
          ...payloadAsRecord, // Original client changes
          updatedAt: op.createdAt.toISOString(), // The time of the update operation, convert to string
          version: resultingEntityVersion, // The version of the entity after this update
        };
        // Explicitly remove storyId if it was somehow in payloadAsRecord
        delete finalChanges.storyId;
        finalVersion = resultingEntityVersion;
      } else if (op.operationType === 'delete') {
        // For 'delete', payload contains id.
        // We need to reconstruct the deleted state from the operationLog.
        finalData = {
          id: op.entityId,
          isDeleted: true,
          updatedAt: op.createdAt.toISOString(), // The time of the delete operation, convert to string
          deletedAt: op.createdAt.toISOString(), // Convert to string
          version: resultingEntityVersion, // The version of the entity after this delete
        };
        finalVersion = resultingEntityVersion;
      }

      // Reconstruct the StoryUpdate object with added metadata
      if (op.operationType === 'create') {
        return {
          type: 'create',
          entity: op.entityType,
          id: op.entityId,
          data: finalData!,
          version: finalVersion,
          operationVersion: op.operationVersion,
          operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
          originatingUser: op.userId, // Add userId
          operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
        } as CreateStoryUpdate;
      } else if (op.operationType === 'update') {
        return {
          type: 'update',
          entity: op.entityType,
          id: op.entityId,
          changes: finalChanges!,
          version: finalVersion,
          operationVersion: op.operationVersion,
          operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
          originatingUser: op.userId, // Add userId
          operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
        } as UpdateStoryUpdate;
      } else if (op.operationType === 'delete') {
        return {
          type: 'delete',
          entity: op.entityType,
          id: op.entityId,
          version: finalVersion,
          operationVersion: op.operationVersion,
          operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
          originatingUser: op.userId, // Add userId
          operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
        } as DeleteStoryUpdate;
      } else if (op.operationType === 'reorder') {
        const reorderPayload = op.payload as { reorderItems: { id: string, newIndex: number }[] };

        if (op.entityType === 'Chapter') { // Reordering scenes within a chapter
          return {
            type: 'reorder',
            entity: 'Chapter',
            id: op.entityId, // The chapter ID whose scenes are reordered
            reorderItems: reorderPayload.reorderItems,
            version: resultingEntityVersion,
            operationVersion: op.operationVersion,
            operationTime: operationTime ? operationTime.toISOString() : undefined,
            originatingUser: op.userId,
            operationId: op.id,
          } as ChapterReorderingStoryUpdate;
        } else if (op.entityType === 'Story') { // Reordering chapters within a story
          return {
            type: 'reorder',
            entity: 'Story',
            id: op.entityId, // The story ID whose chapters are reordered
            reorderItems: reorderPayload.reorderItems,
            version: resultingEntityVersion,
            operationVersion: op.operationVersion,
            operationTime: operationTime ? operationTime.toISOString() : undefined,
            originatingUser: op.userId,
            operationId: op.id,
          } as StoryReorderingStoryUpdate;
        }
        throw new Error(`Unhandled reorder entity type: ${op.entityType}`);
      }
      throw new Error(`Unknown operation type: ${op.operationType}`);
    }));
    // Fetch the current maximum operation version for the story
    const serverMaxOperationVersion = (await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId))
    ).at(0)?.maxVersion || 0;

    // O log continua sendo usado para realtime e para a tela de operações, mas não é
    // uma fonte confiável para reconstruir snapshots importados antes da existência dos
    // favoritos públicos. Enviar o estado autoritativo dos *outros* usuários faz cada
    // cliente convergir sem tocar em um favorito próprio que ainda esteja pendente de push.
    const publicFavorites = story.favoriteBehavior === 'individual_public'
      ? await db.query.favorites.findMany({
          where: and(
            eq(favorites.storyId, storyId),
            ne(favorites.userId, userId),
          ),
        })
      : [];

    return { updates, publicFavorites, serverMaxOperationVersion, role };
  }

  async getStoriesWithLastOperationVersionForUser(userId: string): Promise<{ storyId: string; lastOperationVersion: number; role: EffectiveStoryRole }[]> {
    const ownedStories = await db.query.stories.findMany({
      where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
      columns: {
        id: true,
        version: true,
      },
    });

    const permittedStories = await db.query.storyPermissions.findMany({
      where: and(
        eq(storyPermissions.userId, userId),
        eq(storyPermissions.isDeleted, false),
        or(eq(storyPermissions.permissionType, 'reader'), eq(storyPermissions.permissionType,'writer'))
      ),
      with: {
        story: {
          columns: {
            id: true,
            version: true,
            isDeleted: true,
          },
        },
      },
    });

    /**
     * Carries role alongside version, not just version: the client persists this role into its
     * local `stories.myRole` column the moment it creates the row for a story it just learned
     * about (see `StoryService.importFullStory`), so there's never a window where the row exists
     * server-linked but with an unknown role that a permissive default could mistake for owner.
     */
    const storyMap = new Map<string, { lastOperationVersion: number; role: EffectiveStoryRole }>();

    ownedStories.forEach(story => {
      storyMap.set(story.id, { lastOperationVersion: story.version, role: 'owner' });
    });

    permittedStories.forEach(permission => {
      if (permission.story && !permission.story.isDeleted) {
        storyMap.set(permission.story.id, { lastOperationVersion: permission.story.version, role: permission.permissionType });
      }
    });

    return Array.from(storyMap.entries()).map(([storyId, { lastOperationVersion, role }]) => ({
      storyId,
      lastOperationVersion,
      role,
    }));
  }
}

export const syncService = new SyncService();
