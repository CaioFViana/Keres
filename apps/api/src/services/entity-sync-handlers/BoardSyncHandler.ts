import type { CreateBoardDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateBoardDataSchema, PartialBoardSchema } from '@keres/shared';
import { db } from '../../db';
import { boards } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

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
    super('boards', 'id', 'version', CreateBoardDataSchema, PartialBoardSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateBoardDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: Board with ID ${update.id} already exists.`);
    }

    await db.insert(boards).values({
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
