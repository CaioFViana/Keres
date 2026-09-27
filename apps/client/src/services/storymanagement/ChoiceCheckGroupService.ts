import type { ChoiceCheckGroup } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { choiceCheckGroups } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface ChoiceCheckGroupService {
  getById(id: string): Promise<ChoiceCheckGroup | undefined>;
  getAllByStoryId(storyId: string): Promise<ChoiceCheckGroup[]>;
  getChoiceCheckGroupsByChoiceId(storyId: string, choiceId: string): Promise<ChoiceCheckGroup[]>;
  createChoiceCheckGroup(
    userId: string,
    choiceCheckGroupData: Omit<
      ChoiceCheckGroup,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
    >,
  ): Promise<ChoiceCheckGroup>;
  updateChoiceCheckGroup(
    userId: string,
    id: string,
    choiceCheckGroupData: Partial<
      Omit<
        ChoiceCheckGroup,
        | 'id'
        | 'storyId'
        | 'choiceId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ): Promise<ChoiceCheckGroup>;
  deleteChoiceCheckGroup(userId: string, id: string): Promise<void>;
}

export const createChoiceCheckGroupService = (db: AppDrizzleClient): ChoiceCheckGroupService => {
  const serverService = createServerService(db);
  return {
    async getById(id: string): Promise<ChoiceCheckGroup | undefined> {
      return db.query.choiceCheckGroups.findFirst({
        where: and(eq(choiceCheckGroups.id, id), eq(choiceCheckGroups.isDeleted, false)),
      });
    },

    async getAllByStoryId(storyId: string): Promise<ChoiceCheckGroup[]> {
      return db.query.choiceCheckGroups.findMany({
        where: and(eq(choiceCheckGroups.storyId, storyId), eq(choiceCheckGroups.isDeleted, false)),
        orderBy: [choiceCheckGroups.order, choiceCheckGroups.createdAt],
      });
    },

    async getChoiceCheckGroupsByChoiceId(
      storyId: string,
      choiceId: string,
    ): Promise<ChoiceCheckGroup[]> {
      return db.query.choiceCheckGroups.findMany({
        where: and(
          eq(choiceCheckGroups.storyId, storyId),
          eq(choiceCheckGroups.choiceId, choiceId),
          eq(choiceCheckGroups.isDeleted, false),
        ),
        orderBy: [choiceCheckGroups.order, choiceCheckGroups.createdAt],
      });
    },

    async createChoiceCheckGroup(
      userId: string,
      choiceCheckGroupData: Omit<
        ChoiceCheckGroup,
        'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >,
    ): Promise<ChoiceCheckGroup> {
      await assertStoryIsWritable(db, choiceCheckGroupData.storyId);
      const newChoiceCheckGroup: ChoiceCheckGroup = {
        ...choiceCheckGroupData,
        id: createULID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChoiceCheckGroup.storyId,
        userId,
      );
      await runLocalWrite(db, newChoiceCheckGroup.storyId, () => {
        db.insert(choiceCheckGroups).values(newChoiceCheckGroup).run();
        recordLocalOperationSync(
          db,
          newChoiceCheckGroup.storyId,
          userIdToLog,
          'create',
          'ChoiceCheckGroup',
          newChoiceCheckGroup.id,
          newChoiceCheckGroup,
        );
      });

      return newChoiceCheckGroup;
    },

    async updateChoiceCheckGroup(
      userId: string,
      id: string,
      choiceCheckGroupData: Partial<
        Omit<
          ChoiceCheckGroup,
          | 'id'
          | 'storyId'
          | 'choiceId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
        >
      >,
    ): Promise<ChoiceCheckGroup> {
      const originalChoiceCheckGroup = await db.query.choiceCheckGroups.findFirst({
        where: eq(choiceCheckGroups.id, id),
      });
      if (!originalChoiceCheckGroup) {
        throw new Error(`ChoiceCheckGroup with ID ${id} not found for update.`);
      }
      await assertStoryIsWritable(db, originalChoiceCheckGroup.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalChoiceCheckGroup.storyId,
        userId,
      );
      const updatedChoiceCheckGroup = await runLocalWrite(
        db,
        originalChoiceCheckGroup.storyId,
        () => {
          const updated = db
            .update(choiceCheckGroups)
            .set({
              ...choiceCheckGroupData,
              updatedAt: new Date(),
              version: sql`${choiceCheckGroups.version} + 1`,
            })
            .where(and(eq(choiceCheckGroups.id, id), eq(choiceCheckGroups.isDeleted, false)))
            .returning()
            .get();

          if (!updated) {
            throw new Error(`ChoiceCheckGroup with ID ${id} not found or already deleted.`);
          }

          const changes = getChangedFields(originalChoiceCheckGroup, updated);
          if (Object.keys(changes).length > 0) {
            recordLocalOperationSync(
              db,
              updated.storyId,
              userIdToLog,
              'update',
              'ChoiceCheckGroup',
              updated.id,
              changes,
            );
          }
          return updated;
        },
      );

      return updatedChoiceCheckGroup;
    },

    async deleteChoiceCheckGroup(userId: string, id: string): Promise<void> {
      const choiceCheckGroupToDelete = await db.query.choiceCheckGroups.findFirst({
        where: eq(choiceCheckGroups.id, id),
      });
      if (!choiceCheckGroupToDelete) {
        console.warn(`Attempted to delete non-existent ChoiceCheckGroup ${id}.`);
        return;
      }
      await assertStoryIsWritable(db, choiceCheckGroupToDelete.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        choiceCheckGroupToDelete.storyId,
        userId,
      );
      await runLocalWrite(db, choiceCheckGroupToDelete.storyId, () => {
        const removed = db
          .update(choiceCheckGroups)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${choiceCheckGroups.version} + 1`,
          })
          .where(eq(choiceCheckGroups.id, id))
          .returning({ id: choiceCheckGroups.id, version: choiceCheckGroups.version })
          .get();
        recordLocalOperationSync(
          db,
          choiceCheckGroupToDelete.storyId,
          userIdToLog,
          'delete',
          'ChoiceCheckGroup',
          id,
          {
            id,
            version: removed?.version,
          },
        );
      });
    },
  };
};
