import type { CreateSketchDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateSketchDataSchema, PartialSketchSchema } from '@keres/shared';
import { db, type CompatibleDb } from '../../db';
import { sketches } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

/**
 * Sketches arriving from a client.
 *
 * `content` is validated as a document. The cover gallery link may point at a deleted
 * gallery row; that is allowed on purpose so deleting a snapshot cannot corrupt a drawing.
 */
export class SketchSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSketchDataSchema,
  typeof PartialSketchSchema
> {
  entityName = 'Sketch';

  constructor() {
    super('id', 'version', CreateSketchDataSchema, PartialSketchSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedData: CreateSketchDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!, database);
    if (existing) {
      throw new Error(`Conflict: Sketch with ID ${update.id} already exists.`);
    }

    await database.insert(sketches).values({
      id: update.id!,
      storyId,
      ...validatedData,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
