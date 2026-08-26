import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StatRelationInsert, StatRelationSelect } from '../../db/schema';
import { statRelations } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface StatRelationService {
  /** Every value in the story - enough to build the radar and the ranking in one go. */
  getValuesByStoryId(storyId: string): Promise<StatRelationSelect[]>;
  getValuesByCharacterId(characterId: string): Promise<StatRelationSelect[]>;
  /**
   * Saves a stat's value in a mode. With no row of its own the mode inherits the normal mode's value, so
   * saving is precisely the act of ceasing to inherit.
   */
  setValue(
    currentUserId: string,
    params: {
      storyId: string;
      characterId: string;
      modeId: string | null;
      statId: string;
      value: number;
    },
  ): Promise<void>;
  /** It deletes the mode's own value: the mode goes back to inheriting from the normal mode. */
  clearValue(
    currentUserId: string,
    params: { characterId: string; modeId: string | null; statId: string },
  ): Promise<void>;
}

const valueKey = (characterId: string, modeId: string | null, statId: string) =>
  `${characterId}:${modeId ?? ''}:${statId}`;

/**
 * A queue per (character, mode, stat), at module scope so it holds across instances of the service.
 *
 * Saving a value is read-to-decide-then-write: with no row, create; with a row, update. Two concurrent
 * calls for the same field - which is what an `onBlur` fired twice produces - both read "does not
 * exist" and both insert. The local database has no unique constraint that would catch that (`mode_id`
 * is nullable, and in SQLite, as in Postgres, NULLs are distinct from one another), so the second row
 * only showed up much later, as an opaque synchronization conflict: the server refuses the second
 * create because for it a live value already exists for that trio.
 */
const pendingWrites = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  // A `catch` in the chain: a failed write must not take the next one in the queue down.
  const next = previous.then(task, task);
  pendingWrites.set(
    key,
    next.catch(() => undefined),
  );
  void next.finally(() => {
    if (pendingWrites.get(key) === next) pendingWrites.delete(key);
  });
  return next;
}

export const createStatRelationService = (db: AppDrizzleClient): StatRelationService => {
  const serverService = createServerService(db);

  const findLiveValues = (characterId: string, modeId: string | null, statId: string) =>
    db
      .select()
      .from(statRelations)
      .where(
        and(
          eq(statRelations.characterId, characterId),
          modeId === null ? isNull(statRelations.modeId) : eq(statRelations.modeId, modeId),
          eq(statRelations.statId, statId),
          eq(statRelations.isDeleted, false),
        ),
      )
      // A ULID is sortable by creation time: the oldest row is the one that stays.
      .orderBy(asc(statRelations.id))
      .all();

  const softDelete = async (row: StatRelationSelect, currentUserId: string) => {
    const now = new Date();
    const [updated] = await db
      .update(statRelations)
      .set({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
        version: sql`${statRelations.version} + 1`,
      })
      .where(eq(statRelations.id, row.id))
      .returning({ version: statRelations.version });

    const userIdToLog = await getUserIdForOperation(db, serverService, row.storyId, currentUserId);
    await recordLocalOperation(db, row.storyId, userIdToLog, 'delete', 'StatRelation', row.id, {
      version: updated?.version,
    });
  };

  /**
   * The row that counts for this field, with the surplus ones deleted along the way.
   *
   * The cleanup is the fix for devices that already ended up with duplicates before the queue above
   * existed: without it, the same conflict would come back on every synchronization, because the server
   * would keep refusing the second row's create.
   */
  const takeSingleLiveValue = async (
    currentUserId: string,
    characterId: string,
    modeId: string | null,
    statId: string,
  ): Promise<StatRelationSelect | undefined> => {
    const live = await findLiveValues(characterId, modeId, statId);
    for (const duplicate of live.slice(1)) {
      console.warn(
        `Collapsing a duplicate stat value for character ${characterId} and stat ${statId}.`,
      );
      await softDelete(duplicate, currentUserId);
    }
    return live[0];
  };

  return {
    async getValuesByStoryId(storyId) {
      return db
        .select()
        .from(statRelations)
        .where(and(eq(statRelations.storyId, storyId), eq(statRelations.isDeleted, false)))
        .all();
    },

    async getValuesByCharacterId(characterId) {
      return db
        .select()
        .from(statRelations)
        .where(and(eq(statRelations.characterId, characterId), eq(statRelations.isDeleted, false)))
        .all();
    },

    async setValue(currentUserId, { storyId, characterId, modeId, statId, value }) {
      await assertStoryIsWritable(db, storyId);

      return enqueue(valueKey(characterId, modeId, statId), async () => {
        const existing = await takeSingleLiveValue(currentUserId, characterId, modeId, statId);
        const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

        if (existing) {
          if (existing.value === value) return;
          const [updated] = await db
            .update(statRelations)
            .set({ value, updatedAt: new Date(), version: sql`${statRelations.version} + 1` })
            .where(eq(statRelations.id, existing.id))
            .returning({ version: statRelations.version });
          await recordLocalOperation(
            db,
            storyId,
            userIdToLog,
            'update',
            'StatRelation',
            existing.id,
            { value, version: updated?.version },
          );
          entityEventEmitter.emit('stat_relation_changed', storyId, characterId);
          return;
        }

        const row = prepareNewEntityData<StatRelationInsert>({
          storyId,
          characterId,
          modeId,
          statId,
          value,
        } as Create<StatRelationInsert>);
        const result = await db.insert(statRelations).values(row).returning().get();
        await recordLocalOperation(db, storyId, userIdToLog, 'create', 'StatRelation', row.id, {
          ...result,
        });
        entityEventEmitter.emit('stat_relation_changed', storyId, characterId);
      });
    },

    async clearValue(currentUserId, { characterId, modeId, statId }) {
      return enqueue(valueKey(characterId, modeId, statId), async () => {
        const live = await findLiveValues(characterId, modeId, statId);
        if (live.length === 0) return;
        await assertStoryIsWritable(db, live[0]!.storyId);

        // It deletes every live one, not only the first: clearing the field means saying "there is no value of
        // its own here", and a surviving duplicate would make the value reappear on its own.
        for (const row of live) await softDelete(row, currentUserId);
        entityEventEmitter.emit('stat_relation_changed', live[0]!.storyId, characterId);
      });
    },
  };
};
