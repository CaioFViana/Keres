import type { ChoiceCheck } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient} from '../../db';
import { choiceChecks } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface ChoiceCheckService {
  getById(id: string): Promise<ChoiceCheck | undefined>;
  getAllByStoryId(storyId: string): Promise<ChoiceCheck[]>;
  getChoiceChecksByGroupId(storyId: string, groupId: string): Promise<ChoiceCheck[]>;
  createChoiceCheck(
    userId: string,
    choiceCheckData: Omit<
      ChoiceCheck,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
    >,
  ): Promise<ChoiceCheck>;
  updateChoiceCheck(
    userId: string,
    id: string,
    choiceCheckData: Partial<
      Omit<
        ChoiceCheck,
        | 'id'
        | 'storyId'
        | 'groupId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ): Promise<ChoiceCheck>;
  deleteChoiceCheck(userId: string, id: string): Promise<void>;
}

export const createChoiceCheckService = (db: AppDrizzleClient): ChoiceCheckService => {
  const serverService = createServerService(db);
  return {
    async getById(id: string): Promise<ChoiceCheck | undefined> {
      return db.query.choiceChecks.findFirst({
        where: and(eq(choiceChecks.id, id), eq(choiceChecks.isDeleted, false)),
      });
    },

    async getAllByStoryId(storyId: string): Promise<ChoiceCheck[]> {
      return db.query.choiceChecks.findMany({
        where: and(eq(choiceChecks.storyId, storyId), eq(choiceChecks.isDeleted, false)),
        orderBy: [choiceChecks.order, choiceChecks.createdAt],
      });
    },

    async getChoiceChecksByGroupId(storyId: string, groupId: string): Promise<ChoiceCheck[]> {
      return db.query.choiceChecks.findMany({
        where: and(
          eq(choiceChecks.storyId, storyId),
          eq(choiceChecks.groupId, groupId),
          eq(choiceChecks.isDeleted, false),
        ),
        orderBy: [choiceChecks.order, choiceChecks.createdAt],
      });
    },

    async createChoiceCheck(
      userId: string,
      choiceCheckData: Omit<
        ChoiceCheck,
        'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >,
    ): Promise<ChoiceCheck> {
      await assertStoryIsWritable(db, choiceCheckData.storyId);
      const newChoiceCheck: ChoiceCheck = {
        ...choiceCheckData,
        id: createULID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };

      await db.insert(choiceChecks).values(newChoiceCheck).run();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChoiceCheck.storyId,
        userId,
      );
      await recordLocalOperation(
        db,
        newChoiceCheck.storyId,
        userIdToLog,
        'create',
        'ChoiceCheck',
        newChoiceCheck.id,
        newChoiceCheck,
      );

      return newChoiceCheck;
    },

    async updateChoiceCheck(
      userId: string,
      id: string,
      choiceCheckData: Partial<
        Omit<
          ChoiceCheck,
          | 'id'
          | 'storyId'
          | 'groupId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
        >
      >,
    ): Promise<ChoiceCheck> {
      const originalChoiceCheck = await db.query.choiceChecks.findFirst({
        where: eq(choiceChecks.id, id),
      });
      if (!originalChoiceCheck) {
        throw new Error(`ChoiceCheck with ID ${id} not found for update.`);
      }
      await assertStoryIsWritable(db, originalChoiceCheck.storyId);

      const updatedChoiceCheck = await db
        .update(choiceChecks)
        .set({
          ...choiceCheckData,
          updatedAt: new Date(),
          version: sql`${choiceChecks.version} + 1`,
        })
        .where(and(eq(choiceChecks.id, id), eq(choiceChecks.isDeleted, false)))
        .returning()
        .get();

      if (!updatedChoiceCheck) {
        throw new Error(`ChoiceCheck with ID ${id} not found or already deleted.`);
      }

      const changes = getChangedFields(originalChoiceCheck, updatedChoiceCheck);
      if (Object.keys(changes).length > 0) {
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          updatedChoiceCheck.storyId,
          userId,
        );
        await recordLocalOperation(
          db,
          updatedChoiceCheck.storyId,
          userIdToLog,
          'update',
          'ChoiceCheck',
          updatedChoiceCheck.id,
          changes,
        );
      }

      return updatedChoiceCheck;
    },

    async deleteChoiceCheck(userId: string, id: string): Promise<void> {
      const choiceCheckToDelete = await db.query.choiceChecks.findFirst({
        where: eq(choiceChecks.id, id),
      });
      if (!choiceCheckToDelete) {
        console.warn(`Attempted to delete non-existent ChoiceCheck ${id}.`);
        return;
      }
      await assertStoryIsWritable(db, choiceCheckToDelete.storyId);

      const [removed] = await db
        .update(choiceChecks)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${choiceChecks.version} + 1`,
        })
        .where(eq(choiceChecks.id, id))
        .returning({ id: choiceChecks.id, version: choiceChecks.version });

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        choiceCheckToDelete.storyId,
        userId,
      );
      await recordLocalOperation(
        db,
        choiceCheckToDelete.storyId,
        userIdToLog,
        'delete',
        'ChoiceCheck',
        id,
        { id, version: removed?.version },
      );
    },
  };
};
