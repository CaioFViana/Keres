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
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * As quatro entidades do sistema de status (e os modos) só carregam colunas próprias, sem
 * chave derivada nem cascata como StorySchemaField - então a aplicação de create/update/delete
 * é a mesma para todas, e o que muda é só a tabela. Uma classe base evita quatro cópias do
 * mesmo corpo.
 */
abstract class SimpleTableClientSyncHandler<TTable extends { id: any; isDeleted: any }>
  implements ClientSyncEntityHandler
{
  abstract entityName: string;
  protected abstract get table(): TTable;
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  protected get db(): AppDrizzleClient {
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

    const data = update.data as Record<string, any>;
    await this.db
      .insert(this.table as any)
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

    const changes = { ...(update.changes as Record<string, any>) };
    await this.db
      .update(this.table as any)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
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
      .update(this.table as any)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(this.table.id, update.id));
  }

  async getById(id: string): Promise<any | undefined> {
    const rows = await this.db
      .select()
      .from(this.table as any)
      .where(eq(this.table.id, id))
      .all();
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
