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

const valueKey = (characterId: string, modeId: string | null, statId: string) =>
  `${characterId}:${modeId ?? ''}:${statId}`;

/**
 * Uma fila por (personagem, modo, stat), no escopo do módulo para valer entre instâncias do
 * serviço.
 *
 * Gravar um valor é ler-para-decidir-e-escrever: sem linha, cria; com linha, atualiza. Duas
 * chamadas concorrentes para o mesmo campo - que é o que um `onBlur` disparado duas vezes
 * produz - leem as duas "não existe" e inserem as duas. O banco local não tem único que pegue
 * isso (`mode_id` é anulável, e no SQLite, como no Postgres, NULLs são distintos entre si),
 * então a segunda linha só aparecia lá na frente, como um conflito de sincronização opaco: o
 * servidor recusa o segundo create porque para ele já existe valor vivo para aquele trio.
 */
const pendingWrites = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  // `catch` no encadeamento: uma escrita que falhou não pode derrubar a próxima da fila.
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
      // ULID é ordenável por tempo de criação: a linha mais antiga é a que fica.
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
   * A linha que vale para este campo, com as excedentes apagadas no caminho.
   *
   * A limpeza é o conserto de aparelhos que já ficaram com duplicatas antes da fila acima
   * existir: sem ela, o mesmo conflito voltaria em toda sincronização, porque o servidor
   * continuaria recusando o create da segunda linha.
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

        // Apaga todas as vivas, não só a primeira: limpar o campo é dizer "aqui não há valor
        // próprio", e uma duplicata sobrevivente faria o valor reaparecer sozinho.
        for (const row of live) await softDelete(row, currentUserId);
        entityEventEmitter.emit('stat_relation_changed', live[0]!.storyId, characterId);
      });
    },
  };
};
