import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  Mode,
  Stat,
  StatRelation,
  StatStrength,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/** What the base class needs from each table: the key it addresses rows by, and the soft-delete flag. */
type SimpleSyncTable = SQLiteTable & { id: SQLiteColumn; isDeleted: SQLiteColumn };

/** A timestamp as a sync payload carries it: an ISO string or epoch millis, read by the Date constructor. */
const wireDate = (value: unknown): Date => new Date(value as string | number);

/**
 * The four entities of the stats system (and the modes) only carry columns of their own, with no
 * derived key nor cascade like StorySchemaField - so applying create/update/delete
 * is the same for all of them, and all that changes is the table. A base class avoids four copies of the
 * same body.
 */
abstract class SimpleTableClientSyncHandler<TTable extends SimpleSyncTable>
  implements ClientSyncEntityHandler
{
  abstract entityName: string;
  protected abstract get table(): TTable;
  /** The table as the drizzle builders see it; the methods below do not depend on which of the four it is. */
  private get syncTable(): SimpleSyncTable {
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

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data;
    await this.db
      .insert(this.syncTable)
      .values({
        ...data,
        id: update.id,
        storyId,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      })
      .onConflictDoNothing();
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = { ...update.changes };
    await this.db
      .update(this.syncTable)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? wireDate(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? wireDate(changes.deletedAt) : undefined,
      })
      .where(eq(this.table.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;
    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(this.syncTable)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(this.table.id, update.id));
  }

  /** The row as the table holds it; each subclass narrows it to its entity type. */
  async getById(id: string): Promise<unknown> {
    const rows = await this.db.select().from(this.syncTable).where(eq(this.table.id, id)).all();
    return rows[0];
  }
}

export class StatClientSyncHandler extends SimpleTableClientSyncHandler<typeof schema.stats> {
  entityName = 'Stat';
  protected get table() {
    return schema.stats;
  }
  override async getById(id: string): Promise<Stat | undefined> {
    return (await super.getById(id)) as Stat | undefined;
  }
}

export class StatStrengthClientSyncHandler extends SimpleTableClientSyncHandler<
  typeof schema.statStrengths
> {
  entityName = 'StatStrength';
  protected get table() {
    return schema.statStrengths;
  }
  override async getById(id: string): Promise<StatStrength | undefined> {
    return (await super.getById(id)) as StatStrength | undefined;
  }
}

export class StatRelationClientSyncHandler extends SimpleTableClientSyncHandler<
  typeof schema.statRelations
> {
  entityName = 'StatRelation';
  protected get table() {
    return schema.statRelations;
  }
  override async getById(id: string): Promise<StatRelation | undefined> {
    return (await super.getById(id)) as StatRelation | undefined;
  }
}

export class ModeClientSyncHandler extends SimpleTableClientSyncHandler<typeof schema.modes> {
  entityName = 'Mode';
  protected get table() {
    return schema.modes;
  }
  override async getById(id: string): Promise<Mode | undefined> {
    return (await super.getById(id)) as Mode | undefined;
  }
}
