import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { SQL, eq, sql } from 'drizzle-orm';
import { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { z } from 'zod'; // Import Zod
import { db } from '../../db';
import * as dbSchema from '../../db/schema'; // Import the entire schema

export interface SyncEntityHandler {
  entityName: string;
  findById(id: string): Promise<any | undefined>;
  create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;
  update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void>;
  delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void>;
  checkOwnership(entity: any, userId: string): boolean;
  checkBelongsToStory(entity: any, storyId: string): boolean;
}

export abstract class BaseSyncEntityHandler<CreateType extends z.ZodType<Record<string, any>>, UpdateType extends z.ZodType<Record<string, any>>> implements SyncEntityHandler {
  abstract entityName: string;
  protected _tableName: keyof typeof dbSchema; // Store the table name as a string
  protected idColumnName: string;
  protected storyIdColumnName?: string;
  protected userIdColumnName?: string;
  protected versionColumnName: string;
  protected isDeletedColumnName?: string;
  protected deletedAtColumnName?: string;
  protected createSchema: CreateType; // Zod schema for creation
  protected updateSchema: UpdateType; // Zod schema for updates

  // Getter to dynamically retrieve the table object
  protected get table(): PgTableWithColumns<any> {
    const table = dbSchema[this._tableName];
    if (!table) {
      throw new Error(`Table '${this._tableName}' not found in schema.`);
    }
    return table as PgTableWithColumns<any>;
  }

  constructor(
    tableName: keyof typeof dbSchema, // Accept table name as string
    idColumnName: string,
    versionColumnName: string,
    createSchema: CreateType, // New: Zod schema for creation
    updateSchema: UpdateType, // New: Zod schema for updates
    options?: {
      storyIdColumnName?: string;
      userIdColumnName?: string;
      isDeletedColumnName?: string;
      deletedAtColumnName?: string;
    }
  ) {
    this._tableName = tableName;
    this.idColumnName = idColumnName;
    this.versionColumnName = versionColumnName;
    this.createSchema = createSchema;
    this.updateSchema = updateSchema;
    this.storyIdColumnName = options?.storyIdColumnName;
    this.userIdColumnName = options?.userIdColumnName;
    this.isDeletedColumnName = options?.isDeletedColumnName;
    this.deletedAtColumnName = options?.deletedAtColumnName;
  }

  async findById(id: string): Promise<any | undefined> {
    const results = await db.select()
      .from(this.table)
      .where(eq((this.table as any)[this.idColumnName], id))
      .limit(1);
    return results.at(0);
  }

  abstract create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    this.checkVersionConflict(update.changes.version, currentEntity[this.versionColumnName], update.id!);

    // Validate incoming changes against the update schema.
    const validatedChanges: z.infer<UpdateType> = this.updateSchema.parse(update.changes);

    // Validate operationTime is not in the future
    const clientOperationTime = new Date(update.operationTime!); // operationTime is string in StoryUpdate
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) { // Allow 1 second clock skew
      throw new Error(`Operation time ${update.operationTime} cannot be in the future.`);
    }

    const changes = {
      ...validatedChanges, // Use validated changes
      updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      [this.versionColumnName]: sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
    };

    await db.update(this.table)
      .set(changes)
      .where(eq((this.table as any)[this.idColumnName], update.id!));
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    this.checkVersionConflict(update.version!, currentEntity[this.versionColumnName], update.id!);

    if (!this.isDeletedColumnName || !this.deletedAtColumnName) {
      throw new Error(`Delete not supported for entity ${this.entityName}: missing isDeletedColumnName or deletedAtColumnName.`);
    }

    // Validate operationTime is not in the future
    const clientOperationTime = new Date(update.operationTime!);
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) { // Allow 1 second clock skew
      throw new Error(`Operation time ${update.operationTime} cannot be in the future.`);
    }

    await db.update(this.table)
      .set({
        [this.isDeletedColumnName]: true,
        [this.deletedAtColumnName]: clientOperationTime, // Use client's operationTime for deletedAt
        [this.versionColumnName]: sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
        updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      })
      .where(eq((this.table as any)[this.idColumnName], update.id!));
  }

  checkOwnership(entity: any, userId: string): boolean {
    if (!this.userIdColumnName) {
      // If there's no userIdColumnName, ownership might not be applicable or checked elsewhere
      return true;
    }
    return entity[this.userIdColumnName] === userId;
  }

  checkBelongsToStory(entity: any, storyId: string): boolean {
    if (!this.storyIdColumnName) {
      // If there's no storyIdName, it might be a top-level entity like Story itself
      return true;
    }
    return entity[this.storyIdColumnName] === storyId;
  }

  protected checkVersionConflict(clientVersion: number, serverVersion: number, entityId: string): void {
    if (clientVersion < serverVersion) {
      throw new Error(`Conflict: ${this.entityName} ${entityId} is outdated. Client version ${clientVersion} < Server version ${serverVersion}.`);
    }
  }
}
