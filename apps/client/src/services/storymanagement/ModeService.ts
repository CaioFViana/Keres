import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ModeInsert, ModeSelect } from '../../db/schema';
import { modes, statRelations } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
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
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newMode.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newMode.storyId, () => {
        const inserted = db.insert(modes).values(newMode).returning().get();
        recordLocalOperationSync(db, newMode.storyId, userIdToLog, 'create', 'Mode', newMode.id, {
          ...inserted,
        });
        return inserted;
      });
      entityEventEmitter.emit('mode_changed', newMode.storyId, newMode.characterId);

      return result;
    },

    async updateMode(currentUserId, modeId, modeData) {
      const original = await db.query.modes.findFirst({ where: eq(modes.id, modeId) });
      if (!original) throw new Error(`Mode with ID ${modeId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        original.storyId,
        currentUserId,
      );
      const updated = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(modes)
          .set({ ...modeData, updatedAt: new Date(), version: sql`${modes.version} + 1` })
          .where(eq(modes.id, modeId))
          .returning({ storyId: modes.storyId, version: modes.version })
          .get();
        if (!row) throw new Error(`Failed to update mode ${modeId}.`);
        recordLocalOperationSync(db, row.storyId, userIdToLog, 'update', 'Mode', modeId, {
          ...modeData,
          version: row.version,
        });
        return row;
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

      // That mode's values do not survive it: without the mode, a StatRelation with that modeId would be
      // orphaned and the server would refuse any later edit to it.
      const orphanCount = await runLocalWrite(db, mode.storyId, () => {
        const orphanValues = db
          .select({ id: statRelations.id })
          .from(statRelations)
          .where(and(eq(statRelations.modeId, modeId), eq(statRelations.isDeleted, false)))
          .all();
        for (const value of orphanValues) {
          const updatedValue = db
            .update(statRelations)
            .set({
              isDeleted: true,
              deletedAt: now,
              updatedAt: now,
              version: sql`${statRelations.version} + 1`,
            })
            .where(eq(statRelations.id, value.id))
            .returning({ version: statRelations.version })
            .get();
          recordLocalOperationSync(
            db,
            mode.storyId,
            userIdToLog,
            'delete',
            'StatRelation',
            value.id,
            { version: updatedValue?.version },
          );
        }

        const updated = db
          .update(modes)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${modes.version} + 1`,
          })
          .where(eq(modes.id, modeId))
          .returning({ version: modes.version })
          .get();
        recordLocalOperationSync(db, mode.storyId, userIdToLog, 'delete', 'Mode', modeId, {
          version: updated?.version,
        });
        return orphanValues.length;
      });
      if (orphanCount > 0) {
        entityEventEmitter.emit('stat_relation_changed', mode.storyId, mode.characterId);
      }
      entityEventEmitter.emit('mode_changed', mode.storyId, mode.characterId);
    },
  };
};
