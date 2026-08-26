import type {
  AdminDeletedItemsQuery,
  AdminOperationLogQuery,
  UpdateStoryUpdate,
} from '@keres/shared';
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
   * Lists tombstones (rows with isDeleted=true) through the synchronization handlers - the same source
   * of tables the sync pipeline uses, so it never diverges from it. Without an `entityType`, it sweeps
   * every type; with no real pagination (soft deletes are typically a small minority of the rows, and
   * this is an internal admin tool).
   *
   * Names: a simple field per type (`getSimpleDisplayName`) + shallow composites with batched FKs.
   * `search` filters after enrichment (case-insensitive substring).
   */
  async listDeleted(filters: AdminDeletedItemsQuery): Promise<DeletedItem[]> {
    const handlers = syncService.getEntityHandlers();
    const entityTypes = filters.entityType ? [filters.entityType] : [...handlers.keys()];

    // 'Story' has no `storyIdColumnName` (one story does not belong to another), so a storyId filter does
    // not restrict it - without this skip, "items deleted in story X" would also return completely
    // unrelated stories that happen to be deleted.
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
   * Restores a deleted entity by reusing the very mechanism sync already uses for restores (sending
   * `changes.isDeleted === false` to `BaseSyncEntityHandler.update`), only called directly from the
   * panel instead of through `/sync/:storyId`. It records the restore in the operation log, attributed to
   * the admin, for the audit trail.
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

    // 'Story' does not belong to another story - for it, `storyId` (the context parameter the rest of the
    // sync pipeline uses to attribute the log) is the story's own id.
    const storyId: string = entityType === 'Story' ? id : current.storyId;

    const update: UpdateStoryUpdate = {
      type: 'update',
      entity: entityType,
      id,
      changes: { isDeleted: false, version: current.version },
      operationTime: new Date().toISOString(),
    };

    // The write and the operation log record run in the same transaction - without that, a failure between
    // the two steps (say, the process dying right after the `update`) left the entity restored but with no
    // entry in the operation log, breaking the audit trail this method exists to maintain (the same
    // reasoning as the push in `SyncService.processAndRecordUpdates`).
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
