import { AdminOperationLogQuery, UpdateStoryUpdate } from '@keres/shared';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { operationLog } from '../db/schema';
import { syncService } from './SyncService';

export class UnknownEntityTypeError extends Error {
  constructor(entityType: string) {
    super(`Unknown entity type: ${entityType}`);
    this.name = 'UnknownEntityTypeError';
  }
}

export class RecoveryEntityNotFoundError extends Error {
  constructor() {
    super('Entity not found.');
    this.name = 'RecoveryEntityNotFoundError';
  }
}

export interface DeletedItem {
  entityType: string;
  id: string;
  storyId: string | null;
  deletedAt: Date | null;
  version: number;
  /** Melhor esforço (title/name/text/value/fileName da própria linha); `null` para tabelas de relação sem um campo assim. */
  name: string | null;
}

export class AdminRecoveryService {
  /**
   * Lista tombstones (linhas com isDeleted=true) através dos handlers de sincronização -
   * a mesma fonte de tabelas usadas pelo pipeline de sync, então nunca diverge dela.
   * Sem `entityType`, varre todos os tipos; sem paginação de verdade (soft-deletes são
   * tipicamente uma pequena minoria das linhas, e isto é uma ferramenta interna de admin).
   */
  async listDeleted(filters: { entityType?: string; storyId?: string }): Promise<DeletedItem[]> {
    const handlers = syncService.getEntityHandlers();
    const entityTypes = filters.entityType ? [filters.entityType] : [...handlers.keys()];

    const results: DeletedItem[] = [];
    for (const entityType of entityTypes) {
      // 'Story' não tem `storyIdColumnName` (uma história não pertence a outra), então um
      // filtro de storyId não a restringe - sem este pulo, "itens excluídos na história X"
      // devolveria também histórias completamente alheias que por acaso estão excluídas.
      if (entityType === 'Story' && filters.storyId && !filters.entityType) {
        continue;
      }
      const handler = handlers.get(entityType);
      if (!handler) {
        continue;
      }
      const rows = await handler.findDeleted(filters.storyId);
      for (const row of rows) {
        results.push({ entityType, ...row });
      }
    }

    results.sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));
    return results;
  }

  /**
   * Restaura uma entidade excluída reaproveitando o mesmo mecanismo que o sync já usa
   * para restore (enviar `changes.isDeleted === false` para `BaseSyncEntityHandler.update`),
   * só que chamado diretamente do painel em vez de via `/sync/:storyId`. Registra a
   * restauração no log de operações, atribuída ao admin, para o rastro de auditoria.
   */
  async restore(entityType: string, id: string, adminUserId: string) {
    const handler = syncService.getEntityHandlers().get(entityType);
    if (!handler) {
      throw new UnknownEntityTypeError(entityType);
    }

    const current = await handler.findById(id);
    if (!current) {
      throw new RecoveryEntityNotFoundError();
    }

    // 'Story' não pertence a outra história - para ela, `storyId` (o parâmetro de contexto
    // que o resto do pipeline de sync usa para atribuir o log) é o próprio id da história.
    const storyId: string = entityType === 'Story' ? id : current.storyId;

    const update: UpdateStoryUpdate = {
      type: 'update',
      entity: entityType,
      id,
      changes: { isDeleted: false },
      operationTime: new Date().toISOString(),
    };

    await handler.update(adminUserId, storyId, update, current);
    const restored = await handler.findById(id);

    await syncService.appendOperationLog({
      storyId,
      userId: adminUserId,
      update,
      entityId: id,
      entityVersion: restored?.version,
    });

    return restored;
  }

  async browseOperationLog(filters: AdminOperationLogQuery) {
    const conditions = [];
    if (filters.storyId) conditions.push(eq(operationLog.storyId, filters.storyId));
    if (filters.entityType) conditions.push(eq(operationLog.entityType, filters.entityType));
    if (filters.userId) conditions.push(eq(operationLog.userId, filters.userId));
    if (filters.operationType) conditions.push(eq(operationLog.operationType, filters.operationType));
    if (filters.from) conditions.push(gte(operationLog.createdAt, filters.from));
    if (filters.to) conditions.push(lte(operationLog.createdAt, filters.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      db.select().from(operationLog)
        .where(where)
        .orderBy(desc(operationLog.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      db.select({ total: count() }).from(operationLog).where(where),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }
}

export const adminRecoveryService = new AdminRecoveryService();
