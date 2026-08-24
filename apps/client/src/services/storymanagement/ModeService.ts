import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ModeInsert, ModeSelect} from '../../db/schema';
import { modes, statRelations } from '../../db/schema';
import type { Create} from '../../utils/entityUtils';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface ModeService {
  getModesByStoryId(storyId: string): Promise<ModeSelect[]>;
  getModesByCharacterId(characterId: string): Promise<ModeSelect[]>;
  getById(modeId: string): Promise<ModeSelect | undefined>;
  createMode(currentUserId: string, modeData: Create<ModeInsert>): Promise<ModeSelect>;
  updateMode(
    currentUserId: string,
    modeId: string,
    modeData: Partial<Pick<ModeInsert, 'name' | 'modeChanges' | 'order'>>,
  ): Promise<void>;
  deleteMode(currentUserId: string, modeId: string): Promise<void>;
}

export const createModeService = (db: AppDrizzleClient): ModeService => {
  const serverService = createServerService(db);

  return {
    async getModesByStoryId(storyId) {
      return db
        .select()
        .from(modes)
        .where(and(eq(modes.storyId, storyId), eq(modes.isDeleted, false)))
        .orderBy(asc(modes.order), asc(modes.name))
        .all();
    },

    async getModesByCharacterId(characterId) {
      return db
        .select()
        .from(modes)
        .where(and(eq(modes.characterId, characterId), eq(modes.isDeleted, false)))
        .orderBy(asc(modes.order), asc(modes.name))
        .all();
    },

    async getById(modeId) {
      return db.query.modes.findFirst({
        where: and(eq(modes.id, modeId), eq(modes.isDeleted, false)),
      });
    },

    async createMode(currentUserId, modeData) {
      await assertStoryIsWritable(db, modeData.storyId);

      const newMode = prepareNewEntityData<ModeInsert>(modeData);
      const result = await db.insert(modes).values(newMode).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newMode.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, newMode.storyId, userIdToLog, 'create', 'Mode', newMode.id, {
        ...result,
      });
      entityEventEmitter.emit('mode_changed', newMode.storyId, newMode.characterId);

      return result;
    },

    async updateMode(currentUserId, modeId, modeData) {
      const original = await db.query.modes.findFirst({ where: eq(modes.id, modeId) });
      if (!original) throw new Error(`Mode with ID ${modeId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const [updated] = await db
        .update(modes)
        .set({ ...modeData, updatedAt: new Date(), version: sql`${modes.version} + 1` })
        .where(eq(modes.id, modeId))
        .returning({ storyId: modes.storyId, version: modes.version });
      if (!updated) throw new Error(`Failed to update mode ${modeId}.`);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, updated.storyId, userIdToLog, 'update', 'Mode', modeId, {
        ...modeData,
        version: updated.version,
      });
      entityEventEmitter.emit('mode_changed', updated.storyId, original.characterId);
    },

    async deleteMode(currentUserId, modeId) {
      const mode = await db.query.modes.findFirst({ where: eq(modes.id, modeId) });
      if (!mode || mode.isDeleted) return;
      await assertStoryIsWritable(db, mode.storyId);

      const now = new Date();
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        mode.storyId,
        currentUserId,
      );

      // Os valores daquele modo não sobrevivem a ele: sem o modo, uma StatRelation com esse
      // modeId ficaria órfã e o servidor recusaria qualquer edição posterior nela.
      const orphanValues = await db
        .select({ id: statRelations.id })
        .from(statRelations)
        .where(and(eq(statRelations.modeId, modeId), eq(statRelations.isDeleted, false)))
        .all();
      for (const value of orphanValues) {
        const [updatedValue] = await db
          .update(statRelations)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${statRelations.version} + 1`,
          })
          .where(eq(statRelations.id, value.id))
          .returning({ version: statRelations.version });
        await recordLocalOperation(
          db,
          mode.storyId,
          userIdToLog,
          'delete',
          'StatRelation',
          value.id,
          { version: updatedValue?.version },
        );
      }

      const [updated] = await db
        .update(modes)
        .set({
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: sql`${modes.version} + 1`,
        })
        .where(eq(modes.id, modeId))
        .returning({ version: modes.version });

      await recordLocalOperation(db, mode.storyId, userIdToLog, 'delete', 'Mode', modeId, {
        version: updated?.version,
      });
      if (orphanValues.length > 0) {
        entityEventEmitter.emit('stat_relation_changed', mode.storyId, mode.characterId);
      }
      entityEventEmitter.emit('mode_changed', mode.storyId, mode.characterId);
    },
  };
};
