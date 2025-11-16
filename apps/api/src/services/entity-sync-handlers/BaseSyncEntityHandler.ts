import { SQL, and, eq, sql } from 'drizzle-orm';
import { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { db } from '../../db';
import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '../../schemas/SyncSchemas';
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

export abstract class BaseSyncEntityHandler implements SyncEntityHandler {
  abstract entityName: string;
  protected _tableName: keyof typeof dbSchema; // Store the table name as a string
  protected idColumnName: string;
  protected storyIdColumnName?: string;
  protected userIdColumnName?: string;
  protected versionColumnName: string;
  protected isDeletedColumnName?: string;
  protected deletedAtColumnName?: string;

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
    this.storyIdColumnName = options?.storyIdColumnName;
    this.userIdColumnName = options?.userIdColumnName;
    this.isDeletedColumnName = options?.isDeletedColumnName;
    this.deletedAtColumnName = options?.deletedAtColumnName;
  }

  async findById(id: string): Promise<any | undefined> {
    const relationsBuilder = (db.query as any)[this._tableName];
    return relationsBuilder.findFirst({
      where: eq((this.table as any)[this.idColumnName], id),
    });
  }

  abstract create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    this.checkVersionConflict(update.changes.version, currentEntity[this.versionColumnName], update.id!);

    const changes = {
      ...update.changes,
      updatedAt: new Date(),
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

    await db.update(this.table)
      .set({
        [this.isDeletedColumnName]: true,
        [this.deletedAtColumnName]: new Date(),
        [this.versionColumnName]: sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
        updatedAt: new Date(),
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
