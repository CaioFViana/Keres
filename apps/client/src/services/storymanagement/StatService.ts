import { MAX_PRIMARY_STATS } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StatInsert, StatSelect } from '../../db/schema';
import { stats } from '../../db/schema';
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
import { planContainerOrderSync, planPlacementSync, writeRankChangesSync } from './arrangedWrites';

export interface StatService {
  getStatsByStoryId(storyId: string): Promise<StatSelect[]>;
  getById(statId: string): Promise<StatSelect | undefined>;
  countPrimaryStats(storyId: string): Promise<number>;
  createStat(currentUserId: string, statData: Create<StatInsert>): Promise<StatSelect>;
  updateStat(
    currentUserId: string,
    statId: string,
    statData: Partial<Pick<StatInsert, 'name' | 'isPrimary' | 'order'>>,
  ): Promise<void>;
  reorderStats(
    currentUserId: string,
    storyId: string,
    newOrder: { id: string; order: number }[],
  ): Promise<void>;
  deleteStat(currentUserId: string, statId: string): Promise<void>;
}

export const createStatService = (db: AppDrizzleClient): StatService => {
  const serverService = createServerService(db);

  const livingStats = (storyId: string) =>
    and(eq(stats.storyId, storyId), eq(stats.isDeleted, false));

  /**
   * The axis ceiling belongs to the drawing, not to the screen: going past 12 makes the radar unreadable,
   * and the server refuses the surplus during synchronization. Blocking it here turns that into an
   * immediate form error instead of an opaque sync conflict hours later.
   */
  const assertPrimaryLimit = async (storyId: string, excludeId?: string) => {
    const primaries = await db
      .select({ id: stats.id })
      .from(stats)
      .where(and(livingStats(storyId), eq(stats.isPrimary, true)))
      .all();
    const total = primaries.filter((row) => row.id !== excludeId).length;
    if (total >= MAX_PRIMARY_STATS) {
      throw new Error(`A story can have at most ${MAX_PRIMARY_STATS} primary stats.`);
    }
  };

  return {
    async getStatsByStoryId(storyId) {
      return db
        .select()
        .from(stats)
        .where(livingStats(storyId))
        .orderBy(asc(stats.order), asc(stats.name))
        .all();
    },

    async getById(statId) {
      return db.query.stats.findFirst({
        where: and(eq(stats.id, statId), eq(stats.isDeleted, false)),
      });
    },

    async countPrimaryStats(storyId) {
      const rows = await db
        .select({ id: stats.id })
        .from(stats)
        .where(and(livingStats(storyId), eq(stats.isPrimary, true)))
        .all();
      return rows.length;
    },

    async createStat(currentUserId, statData) {
      await assertStoryIsWritable(db, statData.storyId);
      if (statData.isPrimary !== false) await assertPrimaryLimit(statData.storyId);

      const newStat = prepareNewEntityData<StatInsert>(statData);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newStat.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newStat.storyId, () => {
        // The asked order is where it goes in the list; the database numbers it from its rank.
        const placement = planPlacementSync(
          db,
          'Stat',
          newStat.storyId,
          {},
          newStat.id,
          typeof statData.order === 'number' ? statData.order : undefined,
        );
        db.insert(stats)
          .values({ ...newStat, rank: placement.get(newStat.id)! })
          .run();
        // Recorded as the database holds it: its number already derived from its rank.
        const inserted = db.select().from(stats).where(eq(stats.id, newStat.id)).get()!;
        recordLocalOperationSync(db, newStat.storyId, userIdToLog, 'create', 'Stat', newStat.id, {
          ...inserted,
        });
        writeRankChangesSync(
          db,
          newStat.storyId,
          userIdToLog,
          'Stat',
          placement,
          new Set([newStat.id]),
        );
        return db.select().from(stats).where(eq(stats.id, newStat.id)).get()!;
      });
      entityEventEmitter.emit('stat_changed', newStat.storyId);

      return result;
    },

    async updateStat(currentUserId, statId, requested) {
      // A stat's place is its rank (reorderStats); the order a form holds is never written.
      const { order: _order, ...statData } = requested;
      const original = await db.query.stats.findFirst({ where: eq(stats.id, statId) });
      if (!original) throw new Error(`Stat with ID ${statId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      if (statData.isPrimary === true && !original.isPrimary) {
        await assertPrimaryLimit(original.storyId, statId);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        original.storyId,
        currentUserId,
      );
      const updated = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(stats)
          .set({ ...statData, updatedAt: new Date(), version: sql`${stats.version} + 1` })
          .where(eq(stats.id, statId))
          .returning({ id: stats.id, storyId: stats.storyId, version: stats.version })
          .get();
        if (!row) throw new Error(`Failed to update stat ${statId}.`);
        recordLocalOperationSync(db, row.storyId, userIdToLog, 'update', 'Stat', statId, {
          ...statData,
          version: row.version,
        });
        return row;
      });
      entityEventEmitter.emit('stat_changed', updated.storyId);
    },

    async reorderStats(currentUserId, storyId, newOrder) {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      // Only the stats that moved are edited: each takes the rank of its new place.
      await runLocalWrite(db, storyId, () => {
        const orderedIds = [...newOrder]
          .sort((left, right) => left.order - right.order)
          .map((item) => item.id);
        const changes = planContainerOrderSync(db, 'Stat', storyId, {}, orderedIds);
        writeRankChangesSync(db, storyId, userIdToLog, 'Stat', changes);
      });
      entityEventEmitter.emit('stat_changed', storyId);
    },

    async deleteStat(currentUserId, statId) {
      const stat = await db.query.stats.findFirst({ where: eq(stats.id, statId) });
      if (!stat) {
        console.warn(`Attempted to delete non-existent stat ${statId}.`);
        return;
      }
      if (stat.isDeleted) return;
      await assertStoryIsWritable(db, stat.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        stat.storyId,
        currentUserId,
      );
      const now = new Date();
      await runLocalWrite(db, stat.storyId, () => {
        const updated = db
          .update(stats)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${stats.version} + 1`,
          })
          .where(eq(stats.id, statId))
          .returning({ version: stats.version })
          .get();
        recordLocalOperationSync(db, stat.storyId, userIdToLog, 'delete', 'Stat', statId, {
          version: updated?.version,
        });
      });
      entityEventEmitter.emit('stat_changed', stat.storyId);
    },
  };
};
