import { inArray } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import type { SyncableEntityName } from './entityTableRegistry';
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
  resolveMany(refs: EntityRef[]): Promise<Map<string, string>>;
}

const nameKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

/** The column that carries the display name of each simple type a relation can point at. */
const NAME_COLUMN_BY_ENTITY: Partial<Record<SyncableEntityName, string>> = {
  Board: 'name',
  LocationMap: 'name',
  Character: 'name',
  Location: 'name',
  Item: 'name',
  Tag: 'name',
  Scene: 'name',
  Chapter: 'name',
  Route: 'name',
  Note: 'title',
  WorldRule: 'title',
  Story: 'title',
  StoryArc: 'title',
  Choice: 'text',
  Stat: 'name',
  Mode: 'name',
  StatStrength: 'label',
};

export function createEntityNameBatchResolver(db: AppDrizzleClient): EntityNameBatchResolver {
  return {
    async resolveMany(refs: EntityRef[]): Promise<Map<string, string>> {
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

        // Gallery has no single name column - `title` is optional and falls back to the file's
        // name, just as the rest of the app already does in `EntityService.getEntityName`.
        if (entityType === 'Gallery') {
          const rows = await db
            .select({
              id: (table as any).id,
              title: (table as any).title,
              fileName: (table as any).fileName,
            })
            .from(table)
            .where(inArray((table as any).id, idList));
          for (const row of rows) {
            result.set(nameKey(entityType, row.id), row.title || row.fileName || row.id);
          }
          continue;
        }

        const nameColumn = NAME_COLUMN_BY_ENTITY[entityType as SyncableEntityName];
        if (!nameColumn) continue;

        const rows = await db
          .select({ id: (table as any).id, name: (table as any)[nameColumn] })
          .from(table)
          .where(inArray((table as any).id, idList));
        for (const row of rows) {
          result.set(nameKey(entityType, row.id), row.name || row.id);
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
