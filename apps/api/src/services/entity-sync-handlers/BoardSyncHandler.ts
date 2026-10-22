import type { CreateBoardDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateBoardDataSchema, PartialBoardSchema } from '@keres/shared';
import { db } from '@/db';
import { boards } from '@/db/schema';
import { BaseSyncEntityHandler, type SyncWriteContext } from './BaseSyncEntityHandler';

/**
 * Boards arriving from a client.
 *
 * `content` is validated as a document. Pins may point at deleted entities (ghosts); that is
 * allowed on purpose so deleting a character cannot corrupt a drawing.
 */
export class BoardSyncHandler extends BaseSyncEntityHandler<
  typeof CreateBoardDataSchema,
  typeof PartialBoardSchema
> {
  entityName = 'Board';

  constructor() {
    super('id', 'version', CreateBoardDataSchema, PartialBoardSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(update: CreateStoryUpdate, ctx: SyncWriteContext): Promise<void> {
    const { storyId, database = db } = ctx;
    const validatedData: CreateBoardDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!, database);
    if (existing) {
      throw new Error(`Conflict: Board with ID ${update.id} already exists.`);
    }

    await database.insert(boards).values({
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
