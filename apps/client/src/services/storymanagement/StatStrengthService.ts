import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StatStrengthInsert, StatStrengthSelect } from '../../db/schema';
import { statStrengths } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  afterLocalWrite,
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface StatStrengthService {
  /** Every tier in the story, the default ladder and the overrides together, in ascending order. */
  getStrengthsByStoryId(storyId: string): Promise<StatStrengthSelect[]>;
  /** Only one stat's ladder (a null `statId` = the story's default ladder). */
  getLadder(storyId: string, statId: string | null): Promise<StatStrengthSelect[]>;
  createStrength(
    currentUserId: string,
    data: Create<StatStrengthInsert>,
  ): Promise<StatStrengthSelect>;
  updateStrength(
    currentUserId: string,
    strengthId: string,
    data: Partial<Pick<StatStrengthInsert, 'label' | 'minValue'>>,
  ): Promise<void>;
  deleteStrength(currentUserId: string, strengthId: string): Promise<void>;
  /**
   * Replaces the whole ladder at once. It is how the editing screen saves: comparing the final
   * set with the current one is more predictable than scattering create/update/delete on every keystroke.
   */
  replaceLadder(
    currentUserId: string,
    storyId: string,
    statId: string | null,
    tiers: { id?: string; label: string; minValue: number }[],
  ): Promise<void>;
}

export const createStatStrengthService = (db: AppDrizzleClient): StatStrengthService => {
  const serverService = createServerService(db);

  const ladderFilter = (storyId: string, statId: string | null) =>
    and(
      eq(statStrengths.storyId, storyId),
      statId === null ? isNull(statStrengths.statId) : eq(statStrengths.statId, statId),
      eq(statStrengths.isDeleted, false),
    );

  const assertNoDuplicateFloor = async (
    storyId: string,
    statId: string | null,
    minValue: number,
    excludeId?: string,
  ) => {
    const rows = await db.select().from(statStrengths).where(ladderFilter(storyId, statId)).all();
    if (rows.some((row) => row.minValue === minValue && row.id !== excludeId)) {
      throw new Error(`This ladder already has a tier starting at ${minValue}.`);
    }
  };

  // Raw writes, without the repeated floor guard. `replaceLadder` validates the final set in
  // one go and needs them: checking row by row would refuse a legitimate swap of floors between
  // two tiers just because the intermediate state collides. Synchronous, to run inside a
  // `runLocalWrite` unit - the whole ladder is one unit, so a save never lands half-applied.
  const writeCreate = (userIdToLog: string, data: Create<StatStrengthInsert>) => {
    const row = prepareNewEntityData<StatStrengthInsert>(data);
    const result = db.insert(statStrengths).values(row).returning().get();

    recordLocalOperationSync(db, row.storyId, userIdToLog, 'create', 'StatStrength', row.id, {
      ...result,
    });
    afterLocalWrite(() => entityEventEmitter.emit('stat_strength_changed', row.storyId));
    return result;
  };

  const writeUpdate = (
    userIdToLog: string,
    strengthId: string,
    data: Partial<Pick<StatStrengthInsert, 'label' | 'minValue'>>,
  ) => {
    const updated = db
      .update(statStrengths)
      .set({ ...data, updatedAt: new Date(), version: sql`${statStrengths.version} + 1` })
      .where(eq(statStrengths.id, strengthId))
      .returning({ storyId: statStrengths.storyId, version: statStrengths.version })
      .get();
    if (!updated) throw new Error(`Failed to update stat tier ${strengthId}.`);

    recordLocalOperationSync(
      db,
      updated.storyId,
      userIdToLog,
      'update',
      'StatStrength',
      strengthId,
      { ...data, version: updated.version },
    );
    afterLocalWrite(() => entityEventEmitter.emit('stat_strength_changed', updated.storyId));
  };

  const writeDelete = (userIdToLog: string, strengthId: string) => {
    const row = db.select().from(statStrengths).where(eq(statStrengths.id, strengthId)).get();
    if (!row || row.isDeleted) return;

    const now = new Date();
    const updated = db
      .update(statStrengths)
      .set({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
        version: sql`${statStrengths.version} + 1`,
      })
      .where(eq(statStrengths.id, strengthId))
      .returning({ version: statStrengths.version })
      .get();

    recordLocalOperationSync(db, row.storyId, userIdToLog, 'delete', 'StatStrength', strengthId, {
      version: updated?.version,
    });
    afterLocalWrite(() => entityEventEmitter.emit('stat_strength_changed', row.storyId));
  };

  return {
    async getStrengthsByStoryId(storyId) {
      return db
        .select()
        .from(statStrengths)
        .where(and(eq(statStrengths.storyId, storyId), eq(statStrengths.isDeleted, false)))
        .orderBy(asc(statStrengths.minValue))
        .all();
    },

    async getLadder(storyId, statId) {
      return db
        .select()
        .from(statStrengths)
        .where(ladderFilter(storyId, statId))
        .orderBy(asc(statStrengths.minValue))
        .all();
    },

    async createStrength(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      await assertNoDuplicateFloor(data.storyId, data.statId ?? null, data.minValue);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        data.storyId,
        currentUserId,
      );
      return runLocalWrite(db, data.storyId, () => writeCreate(userIdToLog, data));
    },

    async updateStrength(currentUserId, strengthId, data) {
      const original = await db.query.statStrengths.findFirst({
        where: eq(statStrengths.id, strengthId),
      });
      if (!original) throw new Error(`Stat tier with ID ${strengthId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      if (data.minValue !== undefined && data.minValue !== original.minValue) {
        await assertNoDuplicateFloor(original.storyId, original.statId, data.minValue, strengthId);
      }
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        original.storyId,
        currentUserId,
      );
      await runLocalWrite(db, original.storyId, () => writeUpdate(userIdToLog, strengthId, data));
    },

    async deleteStrength(currentUserId, strengthId) {
      const row = await db.query.statStrengths.findFirst({
        where: eq(statStrengths.id, strengthId),
      });
      if (!row || row.isDeleted) return;
      await assertStoryIsWritable(db, row.storyId);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        row.storyId,
        currentUserId,
      );
      await runLocalWrite(db, row.storyId, () => writeDelete(userIdToLog, strengthId));
    },

    async replaceLadder(currentUserId, storyId, statId, tiers) {
      await assertStoryIsWritable(db, storyId);

      const floors = tiers.map((tier) => tier.minValue);
      if (new Set(floors).size !== floors.length) {
        throw new Error('A ladder cannot have two tiers starting at the same value.');
      }
      if (floors.some((floor) => floor < 0)) {
        throw new Error('A tier cannot start at a negative value.');
      }
      if (tiers.some((tier) => !tier.label.trim())) {
        throw new Error('Every tier needs a label.');
      }

      const existing = await db
        .select()
        .from(statStrengths)
        .where(ladderFilter(storyId, statId))
        .all();
      const existingById = new Map(existing.map((row) => [row.id, row]));
      const keptIds = new Set(tiers.map((tier) => tier.id).filter(Boolean) as string[]);

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await runLocalWrite(db, storyId, () => {
        for (const row of existing) {
          if (!keptIds.has(row.id)) writeDelete(userIdToLog, row.id);
        }
        for (const tier of tiers) {
          const current = tier.id ? existingById.get(tier.id) : undefined;
          if (!current) {
            writeCreate(userIdToLog, {
              storyId,
              statId,
              label: tier.label,
              minValue: tier.minValue,
            } as Create<StatStrengthInsert>);
            continue;
          }
          if (current.label !== tier.label || current.minValue !== tier.minValue) {
            writeUpdate(userIdToLog, current.id, {
              label: tier.label,
              minValue: tier.minValue,
            });
          }
        }
      });
    },
  };
};
