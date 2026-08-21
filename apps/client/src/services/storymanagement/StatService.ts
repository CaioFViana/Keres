import { MAX_PRIMARY_STATS } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { StatInsert, StatSelect, stats } from '../../db/schema';
import { Create, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

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
   * O teto de eixos é do desenho, não da tela: passar de 12 deixa o radar ilegível, e o
   * servidor recusa o excedente na sincronização. Barrar aqui transforma isso num erro de
   * formulário imediato em vez de um conflito de sync opaco horas depois.
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
      const result = await db.insert(stats).values(newStat).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newStat.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, newStat.storyId, userIdToLog, 'create', 'Stat', newStat.id, {
        ...result,
      });
      entityEventEmitter.emit('stat_changed', newStat.storyId);

      return result;
    },

    async updateStat(currentUserId, statId, statData) {
      const original = await db.query.stats.findFirst({ where: eq(stats.id, statId) });
      if (!original) throw new Error(`Stat with ID ${statId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      if (statData.isPrimary === true && !original.isPrimary) {
        await assertPrimaryLimit(original.storyId, statId);
      }

      const [updated] = await db
        .update(stats)
        .set({ ...statData, updatedAt: new Date(), version: sql`${stats.version} + 1` })
        .where(eq(stats.id, statId))
        .returning({ id: stats.id, storyId: stats.storyId, version: stats.version });
      if (!updated) throw new Error(`Failed to update stat ${statId}.`);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updated.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, updated.storyId, userIdToLog, 'update', 'Stat', statId, {
        ...statData,
        version: updated.version,
      });
      entityEventEmitter.emit('stat_changed', updated.storyId);
    },

    async reorderStats(currentUserId, storyId, newOrder) {
      await assertStoryIsWritable(db, storyId);

      const current = await db
        .select({ id: stats.id, order: stats.order })
        .from(stats)
        .where(livingStats(storyId))
        .all();
      const byId = new Map(current.map((row) => [row.id, row]));

      const orderValues = newOrder.map(({ order }) => order).sort((a, b) => a - b);
      const isSequential = orderValues.every((order, index) => order === index);
      if (
        newOrder.length !== current.length ||
        new Set(newOrder.map(({ id }) => id)).size !== current.length ||
        newOrder.some(({ id }) => !byId.has(id)) ||
        !isSequential
      ) {
        throw new Error('Stat reorder must contain every stat of the story exactly once.');
      }

      const changed = newOrder.filter(({ id, order }) => byId.get(id)?.order !== order);
      if (changed.length === 0) return;

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      // Uma operação de update por linha, e não um 'reorder' de Story: o reorder do servidor é
      // exclusivo de Chapter/Scene/StorySchemaField e recusaria um alvo desconhecido.
      for (const stat of changed) {
        const [updated] = await db
          .update(stats)
          .set({ order: stat.order, updatedAt: new Date(), version: sql`${stats.version} + 1` })
          .where(eq(stats.id, stat.id))
          .returning({ version: stats.version });
        await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Stat', stat.id, {
          order: stat.order,
          version: updated?.version,
        });
      }
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

      const now = new Date();
      const [updated] = await db
        .update(stats)
        .set({
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: sql`${stats.version} + 1`,
        })
        .where(eq(stats.id, statId))
        .returning({ version: stats.version });

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        stat.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, stat.storyId, userIdToLog, 'delete', 'Stat', statId, {
        version: updated?.version,
      });
      entityEventEmitter.emit('stat_changed', stat.storyId);
    },
  };
};
