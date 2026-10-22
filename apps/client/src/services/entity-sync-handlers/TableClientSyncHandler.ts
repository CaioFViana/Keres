import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import { logger } from '@/src/utils/logging/logger';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/** What the base class needs from each table: the key it addresses rows by, and the soft-delete flag. */
export type SyncTable = SQLiteTable & { id: SQLiteColumn; isDeleted: SQLiteColumn };

/**
 * How one entity differs from the plain case. Everything a handler does beyond this is its own
 * method; a flag here exists only when several entities need the same variation.
 */
export interface TableSyncBehavior {
  /**
   * Writes that also put the active story's id into the row. A pulled payload does not always carry it,
   * and a row that belongs to a story must not be left without one. Entities whose payload always carries
   * `storyId` do not need it.
   */
  stampStoryId?: { create?: boolean; update?: boolean; delete?: boolean };
  /**
   * An update for a row this device does not hold is dropped instead of applied to nothing, and the row's
   * `updatedAt` takes the time of the operation. For entities whose rows are created by whichever device
   * edits them first, where an update arriving before its create must not be lost as a phantom.
   */
  updateOnlyHeldRows?: boolean;
  /** A create for a row that is already here is ignored (the same create replayed). */
  ignoreDuplicateCreate?: boolean;
  /** A create without `updatedAt` stores "now" instead of crashing on the missing date. */
  defaultMissingUpdatedAt?: boolean;
}

/** A timestamp as a sync payload carries it: an ISO string or epoch millis, read by the Date constructor. */
const wireDate = (value: unknown): Date => new Date(value as string | number);

/**
 * Applies remote create/update/delete of one synchronized table to the local database. Most entities
 * carry only columns of their own, with no derived key and no cascade, so applying an operation is the
 * same for all of them and the only things that change are the table, the entity name and the
 * variations in `TableSyncBehavior`. An entity with more to do (a cascade, protected local columns, a
 * payload that needs reshaping) overrides the one method that differs.
 */
export abstract class TableClientSyncHandler<TTable extends SyncTable>
  implements ClientSyncEntityHandler
{
  abstract readonly entityName: string;
  protected abstract readonly table: TTable;
  protected readonly behavior: TableSyncBehavior = {};
  /** The table as the drizzle builders see it; the methods below do not depend on which entity it is. */
  private get syncTable(): SyncTable {
    return this.table;
  }
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  protected get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error(`${this.entityName}ClientSyncHandler: Drizzle client (db) not set.`);
    }
    return this.dbInstance;
  }

  /** The active story's id, for the writes of entities that need it stamped into the row. */
  private storyStamp(
    operation: 'create' | 'update' | 'delete',
    storyId: string | undefined,
  ): { storyId?: string } {
    if (!this.behavior.stampStoryId?.[operation]) return {};
    if (!storyId) {
      throw new Error(
        `${this.entityName}ClientSyncHandler: ${operation} needs the active story id.`,
      );
    }
    return { storyId };
  }

  async applyCreate(update: CreateStoryUpdate, storyId?: string): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data;
    const insert = this.db.insert(this.syncTable).values({
      ...data,
      id: update.id,
      ...this.storyStamp('create', storyId),
      createdAt: new Date(data.createdAt),
      updatedAt:
        this.behavior.defaultMissingUpdatedAt && !data.updatedAt
          ? new Date()
          : new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    await (this.behavior.ignoreDuplicateCreate ? insert.onConflictDoNothing() : insert);
    logger.debug(`Applied create for ${this.entityName} ${update.id}`);
  }

  async applyUpdate(update: UpdateStoryUpdate, storyId?: string): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    if (this.behavior.updateOnlyHeldRows && !(await this.getById(update.id))) {
      logger.debug(`Skipped update for ${this.entityName} ${update.id}: not held on this device`);
      return;
    }

    const changes = { ...update.changes };
    await this.db
      .update(this.syncTable)
      .set({
        ...changes,
        ...this.storyStamp('update', storyId),
        updatedAt: this.behavior.updateOnlyHeldRows
          ? new Date(update.operationTime || new Date())
          : new Date(),
        createdAt: changes.createdAt ? wireDate(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? wireDate(changes.deletedAt) : undefined,
      })
      .where(eq(this.table.id, update.id));
    logger.debug(`Applied update for ${this.entityName} ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate, storyId?: string): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(this.syncTable)
      .set({
        ...this.storyStamp('delete', storyId),
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(this.table.id, update.id));
    logger.debug(`Applied delete for ${this.entityName} ${update.id}`);
  }

  /** The row as the table holds it, or undefined. */
  async getById(id: string): Promise<TTable['$inferSelect'] | undefined> {
    const rows = await this.db.select().from(this.syncTable).where(eq(this.table.id, id)).limit(1);
    return rows[0] as TTable['$inferSelect'] | undefined;
  }
}
