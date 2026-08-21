import { and, eq, isNull, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { StatRelationInsert, StatRelationSelect, statRelations } from '../../db/schema';
import { Create, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface StatRelationService {
  /** Todos os valores da história - o suficiente para montar radar e ranking de uma vez. */
  getValuesByStoryId(storyId: string): Promise<StatRelationSelect[]>;
  getValuesByCharacterId(characterId: string): Promise<StatRelationSelect[]>;
  /**
   * Grava o valor de um stat num modo. Sem linha própria o modo herda o valor do modo normal,
   * então gravar é justamente o ato de deixar de herdar.
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
  /** Apaga o valor próprio: o modo volta a herdar do modo normal. */
  clearValue(
    currentUserId: string,
    params: { characterId: string; modeId: string | null; statId: string },
  ): Promise<void>;
}

export const createStatRelationService = (db: AppDrizzleClient): StatRelationService => {
  const serverService = createServerService(db);

  const findValue = (characterId: string, modeId: string | null, statId: string) =>
    db.query.statRelations.findFirst({
      where: and(
        eq(statRelations.characterId, characterId),
        modeId === null ? isNull(statRelations.modeId) : eq(statRelations.modeId, modeId),
        eq(statRelations.statId, statId),
        eq(statRelations.isDeleted, false),
      ),
    });

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

      const existing = await findValue(characterId, modeId, statId);
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
    },

    async clearValue(currentUserId, { characterId, modeId, statId }) {
      const existing = await findValue(characterId, modeId, statId);
      if (!existing) return;
      await assertStoryIsWritable(db, existing.storyId);

      const now = new Date();
      const [updated] = await db
        .update(statRelations)
        .set({
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: sql`${statRelations.version} + 1`,
        })
        .where(eq(statRelations.id, existing.id))
        .returning({ version: statRelations.version });

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        existing.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        existing.storyId,
        userIdToLog,
        'delete',
        'StatRelation',
        existing.id,
        { version: updated?.version },
      );
      entityEventEmitter.emit('stat_relation_changed', existing.storyId, characterId);
    },
  };
};
