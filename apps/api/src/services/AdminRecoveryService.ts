import type { AdminDeletedItemsQuery, AdminOperationLogQuery, UpdateStoryUpdate } from '@keres/shared';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { db, withTransaction } from '../db';
import { operationLog } from '../db/schema';
import {
  enrichDeletedDisplayNames,
  enrichOperationLogNames,
  type EnrichableDeletedRow,
} from './AdminRecoveryDisplayNames';
import type { SyncEntityHandler } from './entity-sync-handlers/BaseSyncEntityHandler';
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
  /** Resolved Story.title when storyId is known (includes soft-deleted stories). */
  storyTitle: string | null;
  deletedAt: Date | null;
  version: number;
  /** Simple or composite display name; null only when enrichment still cannot label the row. */
  name: string | null;
}

function matchesSearch(item: DeletedItem, search: string): boolean {
  const q = search.toLowerCase();
  return (
    (item.name?.toLowerCase().includes(q) ?? false) ||
    (item.storyTitle?.toLowerCase().includes(q) ?? false) ||
    item.id.toLowerCase().includes(q) ||
    item.entityType.toLowerCase().includes(q) ||
    (item.storyId?.toLowerCase().includes(q) ?? false)
  );
}

export class AdminRecoveryService {
  /**
   * Lista tombstones (linhas com isDeleted=true) através dos handlers de sincronização -
   * a mesma fonte de tabelas usadas pelo pipeline de sync, então nunca diverge dela.
   * Sem `entityType`, varre todos os tipos; sem paginação de verdade (soft-deletes são
   * tipicamente uma pequena minoria das linhas, e isto é uma ferramenta interna de admin).
   *
   * Nomes: campo simples por tipo (`getSimpleDisplayName`) + compostos rasos com batch de FKs.
   * `search` filtra depois do enriquecimento (substring case-insensitive).
   */
  async listDeleted(filters: AdminDeletedItemsQuery): Promise<DeletedItem[]> {
    const handlers = syncService.getEntityHandlers();
    const entityTypes = filters.entityType ? [filters.entityType] : [...handlers.keys()];

    // 'Story' não tem `storyIdColumnName` (uma história não pertence a outra), então um
    // filtro de storyId não a restringe - sem este pulo, "itens excluídos na história X"
    // devolveria também histórias completamente alheias que por acaso estão excluídas.
    const entries: Array<[string, SyncEntityHandler]> = entityTypes
      .filter((entityType) => !(entityType === 'Story' && filters.storyId && !filters.entityType))
      .map((entityType) => [entityType, handlers.get(entityType)] as const)
      .filter((entry): entry is [string, SyncEntityHandler] => !!entry[1]);

    const rowsByType = await Promise.all(
      entries.map(([, handler]) => handler.findDeleted(filters.storyId)),
    );

    const enrichable: Array<EnrichableDeletedRow & { deletedAt: Date | null; version: number }> =
      [];
    entries.forEach(([entityType], index) => {
      for (const row of rowsByType[index]) {
        enrichable.push({
          entityType,
          id: row.id,
          storyId: row.storyId,
          deletedAt: row.deletedAt,
          version: row.version,
          name: row.name,
          row: row.row,
        });
      }
    });

    const { names, storyTitles } = await enrichDeletedDisplayNames(enrichable);

    let results: DeletedItem[] = enrichable.map((item) => {
      const key = `${item.entityType}:${item.id}`;
      const storyId = item.entityType === 'Story' ? item.id : item.storyId;
      return {
        entityType: item.entityType,
        id: item.id,
        storyId: item.storyId,
        storyTitle: storyId ? (storyTitles.get(storyId) ?? null) : null,
        deletedAt: item.deletedAt,
        version: item.version,
        name: names.get(key) ?? item.name,
      };
    });

    const search = filters.search?.trim();
    if (search) {
      results = results.filter((item) => matchesSearch(item, search));
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
      changes: { isDeleted: false, version: current.version },
      operationTime: new Date().toISOString(),
    };

    // A escrita e o registro no log de operações rodam na mesma transação - sem isto, uma
    // falha entre os dois passos (ex.: o processo cair logo após o `update`) deixava a
    // entidade restaurada mas sem nenhuma entrada no log de operações, quebrando o rastro de
    // auditoria que este método existe para manter (mesmo raciocínio do push em
    // `SyncService.processAndRecordUpdates`).
    return withTransaction(async () => {
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
    });
  }

  async browseOperationLog(filters: AdminOperationLogQuery) {
    const conditions = [];
    if (filters.storyId) conditions.push(eq(operationLog.storyId, filters.storyId));
    if (filters.entityType) conditions.push(eq(operationLog.entityType, filters.entityType));
    if (filters.userId) conditions.push(eq(operationLog.userId, filters.userId));
    if (filters.operationType)
      conditions.push(eq(operationLog.operationType, filters.operationType));
    if (filters.from) conditions.push(gte(operationLog.createdAt, filters.from));
    if (filters.to) conditions.push(lte(operationLog.createdAt, filters.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const search = filters.search?.trim();
    const scanLimit = search ? 500 : filters.pageSize;
    const scanOffset = search ? 0 : (filters.page - 1) * filters.pageSize;

    const [rawItems, [{ total: sqlTotal }]] = await Promise.all([
      db
        .select()
        .from(operationLog)
        .where(where)
        .orderBy(desc(operationLog.createdAt))
        .limit(scanLimit)
        .offset(scanOffset),
      db.select({ total: count() }).from(operationLog).where(where),
    ]);

    const enrichment = await enrichOperationLogNames(
      rawItems.map((row) => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        storyId: row.storyId,
        userId: row.userId,
        payload: row.payload,
      })),
    );

    const items = rawItems.map((row) => {
      const extra = enrichment.get(row.id);
      return {
        ...row,
        entityName: extra?.entityName ?? null,
        storyTitle: extra?.storyTitle ?? null,
        username: extra?.username ?? null,
      };
    });

    if (!search) {
      return { items, total: sqlTotal, page: filters.page, pageSize: filters.pageSize };
    }

    const q = search.toLowerCase();
    const filtered = items.filter((item) => {
      return (
        (item.entityName?.toLowerCase().includes(q) ?? false) ||
        (item.storyTitle?.toLowerCase().includes(q) ?? false) ||
        (item.username?.toLowerCase().includes(q) ?? false) ||
        item.entityType.toLowerCase().includes(q) ||
        item.entityId.toLowerCase().includes(q) ||
        item.userId.toLowerCase().includes(q) ||
        item.storyId.toLowerCase().includes(q) ||
        item.operationType.toLowerCase().includes(q)
      );
    });
    const start = (filters.page - 1) * filters.pageSize;
    return {
      items: filtered.slice(start, start + filters.pageSize),
      total: filtered.length,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
}

export const adminRecoveryService = new AdminRecoveryService();
