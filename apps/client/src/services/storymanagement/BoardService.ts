import type { BoardContentType } from '@keres/shared';
import { BoardContentSchema } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { BoardInsert, BoardSelect } from '../../db/schema';
import { boards } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface BoardService {
  getBoardsForStory(storyId: string): Promise<BoardSelect[]>;
  getById(boardId: string): Promise<BoardSelect | undefined>;
  createBoard(currentUserId: string, data: Create<BoardInsert>): Promise<BoardSelect>;
  updateBoard(
    currentUserId: string,
    boardId: string,
    changes: Partial<{
      name: string;
      description: string | null;
      content: BoardContentType;
    }>,
  ): Promise<BoardSelect>;
  deleteBoard(currentUserId: string, boardId: string): Promise<void>;
}

export const createBoardService = (db: AppDrizzleClient): BoardService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(boards.storyId, storyId), eq(boards.isDeleted, false));

  const logOperation = async (
    currentUserId: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    boardId: string,
    payload: Record<string, unknown>,
  ) => {
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await recordLocalOperation(db, storyId, userIdToLog, type, 'Board', boardId, payload);
    entityEventEmitter.emit('board_changed', storyId, boardId);
  };

  return {
    async getBoardsForStory(storyId) {
      return db.select().from(boards).where(liveInStory(storyId)).orderBy(asc(boards.name)).all();
    },

    async getById(boardId) {
      return db.query.boards.findFirst({ where: eq(boards.id, boardId) });
    },

    async createBoard(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const content = BoardContentSchema.parse(data.content ?? { nodes: [], edges: [] });
      const board = prepareNewEntityData<BoardInsert>({ ...data, content });
      const result = await db.insert(boards).values(board).returning().get();
      await logOperation(currentUserId, board.storyId, 'create', board.id, { ...result });
      return result;
    },

    async updateBoard(currentUserId, boardId, changes) {
      const original = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
      if (!original) throw new Error(`Board with ID ${boardId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const nextContent =
        changes.content !== undefined ? BoardContentSchema.parse(changes.content) : undefined;
      const normalised = {
        ...changes,
        ...(nextContent !== undefined ? { content: nextContent } : {}),
      };
      const changed = getChangedFields(original, { ...original, ...normalised });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      await db
        .update(boards)
        .set({ ...normalised, updatedAt: new Date(), version: sql`${boards.version} + 1` })
        .where(eq(boards.id, boardId));

      const updated = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
      if (!updated) throw new Error(`Failed to retrieve updated Board ${boardId}.`);

      await logOperation(
        currentUserId,
        updated.storyId,
        'update',
        boardId,
        getChangedFields(original, updated),
      );
      return updated;
    },

    async deleteBoard(currentUserId, boardId) {
      const original = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent board ${boardId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);

      const [updated] = await db
        .update(boards)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${boards.version} + 1`,
        })
        .where(eq(boards.id, boardId))
        .returning({
          id: boards.id,
          storyId: boards.storyId,
          isDeleted: boards.isDeleted,
          version: boards.version,
        });

      if (!updated) throw new Error(`Failed to delete board ${boardId}.`);

      await logOperation(currentUserId, updated.storyId, 'delete', boardId, {
        id: updated.id,
        isDeleted: updated.isDeleted,
        version: updated.version,
      });
    },
  };
};
