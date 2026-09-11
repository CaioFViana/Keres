import type { OperationLogEntityType } from '@keres/shared';
import { getEntityDomainHandler } from '@keres/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { getEntityTable } from './entityTableRegistry';

export interface EntityRef {
  entityType: string;
  entityId: string;
}

export interface EntityNameBatchResolver {
  /**
   * Resolves every reference at once: it groups by type, does one `inArray` query per
   * table (not one per reference), and returns a map `"Type:id" -> display name`.
   *
   * It exists because `EntityService.getEntityIdentifier`/`_resolveRelationEntityName` are
   * strictly one-id-at-a-time - correct for a detail screen with few fields, but a
   * sync conflict list can reference dozens of entities (the same one several times).
   * Resolving them one by one would become dozens of sequential round-trips to SQLite; this does at most
   * one query per distinct entity type touched by the whole batch.
   */
  resolveMany(
    refs: EntityRef[],
    options?: { includeDeleted?: boolean },
  ): Promise<Map<string, string>>;
}

const nameKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

export function createEntityNameBatchResolver(db: AppDrizzleClient): EntityNameBatchResolver {
  return {
    async resolveMany(
      refs: EntityRef[],
      options: { includeDeleted?: boolean } = {},
    ): Promise<Map<string, string>> {
      const idsByType = new Map<string, Set<string>>();
      for (const ref of refs) {
        if (!ref.entityType || !ref.entityId) continue;
        const set = idsByType.get(ref.entityType) ?? new Set<string>();
        set.add(ref.entityId);
        idsByType.set(ref.entityType, set);
      }

      const result = new Map<string, string>();

      for (const [entityType, ids] of idsByType) {
        const table = getEntityTable(entityType);
        if (!table) continue;
        const idList = Array.from(ids);

        const displayName = getEntityDomainHandler(
          entityType as OperationLogEntityType,
        )?.displayName;
        if (!displayName) continue;

        const selection: Record<string, any> = { id: (table as any).id };
        for (const field of displayName.fields) {
          selection[field] = (table as any)[field];
        }

        const conditions = [inArray((table as any).id, idList)];
        if (options.includeDeleted === false && 'isDeleted' in table) {
          conditions.push(eq((table as any).isDeleted, false));
        }
        const rows = await db
          .select(selection)
          .from(table)
          .where(and(...conditions));
        for (const row of rows) {
          const name = displayName.getName(row as Record<string, unknown>);
          result.set(nameKey(entityType, row.id as string), name ?? (row.id as string));
        }
      }

      return result;
    },
  };
}

export interface EntitySnapshotResolver {
  /**
   * Resolves each reference's whole local row, not just a name - used to fill in
   * fields missing from both `localValues` and `serverValues` of a `PendingConflict`
   * (e.g. a `deleted_on_server` conflict deliberately carries only `{isDeleted, version}` from the
   * server's side - the local row itself was not erased, and still has the original `name`/relation
   * IDs). The same grouping by type and one `inArray` query per table that
   * `resolveMany` already uses.
   */
  resolveMany(refs: EntityRef[]): Promise<Map<string, Record<string, any>>>;
}

export function createEntitySnapshotResolver(db: AppDrizzleClient): EntitySnapshotResolver {
  return {
    async resolveMany(refs: EntityRef[]): Promise<Map<string, Record<string, any>>> {
      const idsByType = new Map<string, Set<string>>();
      for (const ref of refs) {
        if (!ref.entityType || !ref.entityId) continue;
        const set = idsByType.get(ref.entityType) ?? new Set<string>();
        set.add(ref.entityId);
        idsByType.set(ref.entityType, set);
      }

      const result = new Map<string, Record<string, any>>();

      for (const [entityType, ids] of idsByType) {
        const table = getEntityTable(entityType);
        if (!table) continue;
        const idList = Array.from(ids);

        const rows = (await db
          .select()
          .from(table)
          .where(inArray((table as any).id, idList))) as Record<string, any>[];
        for (const row of rows) {
          result.set(nameKey(entityType, row.id), row);
        }
      }

      return result;
    },
  };
}
