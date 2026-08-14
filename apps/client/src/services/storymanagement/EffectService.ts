import { Effect } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient, effects } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface EffectService {
  getById(id: string): Promise<Effect | undefined>;
  getAllByStoryId(storyId: string): Promise<Effect[]>;
  getEffectsByEntity(
    storyId: string,
    entityType: Effect['entityType'],
    entityId: string,
  ): Promise<Effect[]>;
  createEffect(
    userId: string,
    effectData: Omit<
      Effect,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
    >,
  ): Promise<Effect>;
  updateEffect(
    userId: string,
    id: string,
    effectData: Partial<
      Omit<
        Effect,
        | 'id'
        | 'storyId'
        | 'entityType'
        | 'entityId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ): Promise<Effect>;
  deleteEffect(userId: string, id: string): Promise<void>;
}

export const createEffectService = (db: AppDrizzleClient): EffectService => {
  const serverService = createServerService(db);
  return {
    async getById(id: string): Promise<Effect | undefined> {
      return db.query.effects.findFirst({
        where: and(eq(effects.id, id), eq(effects.isDeleted, false)),
      });
    },

    async getAllByStoryId(storyId: string): Promise<Effect[]> {
      return db.query.effects.findMany({
        where: and(eq(effects.storyId, storyId), eq(effects.isDeleted, false)),
        orderBy: [effects.createdAt],
      });
    },

    async getEffectsByEntity(
      storyId: string,
      entityType: Effect['entityType'],
      entityId: string,
    ): Promise<Effect[]> {
      return db.query.effects.findMany({
        where: and(
          eq(effects.storyId, storyId),
          eq(effects.entityType, entityType),
          eq(effects.entityId, entityId),
          eq(effects.isDeleted, false),
        ),
        orderBy: [effects.createdAt],
      });
    },

    async createEffect(
      userId: string,
      effectData: Omit<
        Effect,
        'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >,
    ): Promise<Effect> {
      await assertStoryIsWritable(db, effectData.storyId);
      const newEffect: Effect = {
        ...effectData,
        id: createULID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };

      await db.insert(effects).values(newEffect).run();

      const userIdToLog = await getUserIdForOperation(db, serverService, newEffect.storyId, userId);
      await recordLocalOperation(
        db,
        newEffect.storyId,
        userIdToLog,
        'create',
        'Effect',
        newEffect.id,
        newEffect,
      );

      return newEffect;
    },

    async updateEffect(
      userId: string,
      id: string,
      effectData: Partial<
        Omit<
          Effect,
          | 'id'
          | 'storyId'
          | 'entityType'
          | 'entityId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
        >
      >,
    ): Promise<Effect> {
      const originalEffect = await db.query.effects.findFirst({ where: eq(effects.id, id) });
      if (!originalEffect) {
        throw new Error(`Effect with ID ${id} not found for update.`);
      }
      await assertStoryIsWritable(db, originalEffect.storyId);

      const updatedEffect = await db
        .update(effects)
        .set({
          ...effectData,
          updatedAt: new Date(),
          version: sql`${effects.version} + 1`,
        })
        .where(and(eq(effects.id, id), eq(effects.isDeleted, false)))
        .returning()
        .get();

      if (!updatedEffect) {
        throw new Error(`Effect with ID ${id} not found or already deleted.`);
      }

      const changes = getChangedFields(originalEffect, updatedEffect);
      if (Object.keys(changes).length > 0) {
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          updatedEffect.storyId,
          userId,
        );
        await recordLocalOperation(
          db,
          updatedEffect.storyId,
          userIdToLog,
          'update',
          'Effect',
          updatedEffect.id,
          changes,
        );
      }

      return updatedEffect;
    },

    async deleteEffect(userId: string, id: string): Promise<void> {
      const effectToDelete = await db.query.effects.findFirst({ where: eq(effects.id, id) });
      if (!effectToDelete) {
        console.warn(`Attempted to delete non-existent Effect ${id}.`);
        return;
      }
      await assertStoryIsWritable(db, effectToDelete.storyId);

      await db
        .update(effects)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${effects.version} + 1`,
        })
        .where(eq(effects.id, id))
        .run();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        effectToDelete.storyId,
        userId,
      );
      await recordLocalOperation(db, effectToDelete.storyId, userIdToLog, 'delete', 'Effect', id, {
        id,
      });
    },
  };
};
