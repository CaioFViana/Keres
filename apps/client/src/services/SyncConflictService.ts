import { SyncConflictReason } from '@keres/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { OperationLogSelect, SyncConflictSelect } from '../db/schema';
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getEntityTable, toEntityColumns } from './entityTableRegistry';

/**
 * Campos que nunca entram num comparativo de conflito: são metadados de bookkeeping,
 * mudam em toda escrita e portanto apareceriam como "divergentes" em todo conflito sem
 * que o usuário tenha qualquer decisão a tomar sobre eles.
 */
const BOOKKEEPING_FIELDS = new Set([
  'id',
  'storyId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

export type ConflictResolution = 'keep_local' | 'keep_server' | 'merge' | 'restore' | 'discard';

/** Um conflito com os JSONs já desempacotados, como a tela consome. */
export interface PendingConflict {
  id: string;
  storyId: string;
  entityType: string;
  entityId: string;
  reason: SyncConflictReason;
  localOperationType: 'create' | 'update' | 'delete' | 'reorder';
  localOperationIds: string[];
  /** Campos que o usuário mudou e ainda não foram aceitos pelo servidor. */
  localValues: Record<string, any>;
  /** Estado da entidade no servidor. `null` quando ela não existe mais lá. */
  serverValues: Record<string, any> | null;
  clientVersion: number | null;
  serverVersion: number | null;
  message: string | null;
  detectedAt: Date;
  /** Campos em que os dois lados divergem - o que a tela pede para o usuário decidir. */
  contestedFields: string[];
  /** A entidade foi excluída no servidor mas o usuário continuou editando. */
  isDeletedOnServer: boolean;
  /** O usuário excluiu localmente algo que o servidor continuou editando. */
  isLocalDelete: boolean;
}

export interface RecordConflictInput {
  storyId: string;
  entityType: string;
  entityId: string;
  reason: SyncConflictReason;
  localOperationType: 'create' | 'update' | 'delete' | 'reorder';
  localOperationIds: string[];
  localValues: Record<string, any>;
  serverValues?: Record<string, any> | null;
  clientVersion?: number | null;
  serverVersion?: number | null;
  message?: string | null;
}

export interface SyncConflictService {
  recordConflict(input: RecordConflictInput): Promise<void>;
  getPendingConflicts(storyId?: string): Promise<PendingConflict[]>;
  countPendingConflicts(storyId?: string): Promise<number>;
  /** Preserva o trabalho do usuário, rebaseado sobre a versão atual do servidor. */
  resolveKeepLocal(conflictId: string, chosenValues?: Record<string, any>): Promise<void>;
  /** Aceita o que o servidor tem e descarta as operações locais pendentes. */
  resolveKeepServer(conflictId: string): Promise<void>;
  /** Tira o conflito da frente sem resolver; as operações locais seguem bloqueadas. */
  dismissConflict(conflictId: string): Promise<void>;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Compara valores vindos de JSON de forma tolerante a Date-vs-string e null-vs-undefined. */
function valuesDiffer(a: any, b: any): boolean {
  if (a === b) return false;
  if (a == null && b == null) return false;
  if (a instanceof Date || b instanceof Date) {
    const timeA = a ? new Date(a).getTime() : null;
    const timeB = b ? new Date(b).getTime() : null;
    return timeA !== timeB;
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  }
  return true;
}

/**
 * Campos que o usuário mudou e sobre os quais o servidor tem outra opinião.
 *
 * Só estes precisam de decisão: se o usuário mudou o resumo e o servidor mudou o título,
 * os dois cabem juntos e não há nada para escolher.
 *
 * A chave tem que estar *presente* em `serverValues`, e não apenas divergir. No caminho do
 * pull, `serverValues` são só os campos que a operação remota alterou: um campo ausente
 * significa que o servidor não opinou sobre ele, e compará-lo com `undefined` marcaria como
 * disputado justamente o que deveria se mesclar em silêncio. No caminho do push,
 * `serverValues` é a entidade inteira, então todas as chaves existem e vale a comparação.
 */
export function findContestedFields(
  localValues: Record<string, any>,
  serverValues: Record<string, any> | null,
): string[] {
  if (!serverValues) {
    return Object.keys(localValues).filter((key) => !BOOKKEEPING_FIELDS.has(key));
  }
  return Object.keys(localValues)
    .filter((key) => !BOOKKEEPING_FIELDS.has(key))
    .filter((key) => key in serverValues)
    .filter((key) => valuesDiffer(localValues[key], serverValues[key]));
}

/** Une os payloads das operações locais pendentes num único conjunto de valores desejados. */
export function mergeLocalOperationPayloads(operations: OperationLogSelect[]): Record<string, any> {
  const merged: Record<string, any> = {};
  for (const op of operations) {
    const payload = parseJson<Record<string, any>>(op.payload, {});
    for (const [key, value] of Object.entries(payload)) {
      if (BOOKKEEPING_FIELDS.has(key)) continue;
      // Operações mais recentes vêm depois e portanto ganham: é a última intenção do usuário.
      merged[key] = value;
    }
  }
  return merged;
}

export const createSyncConflictService = (db: AppDrizzleClient): SyncConflictService => {
  const toPendingConflict = (row: SyncConflictSelect): PendingConflict => {
    const localValues = parseJson<Record<string, any>>(row.localValues, {});
    const serverValues = parseJson<Record<string, any> | null>(row.serverValues, null);

    return {
      id: row.id,
      storyId: row.storyId,
      entityType: row.entityType,
      entityId: row.entityId,
      reason: row.reason as SyncConflictReason,
      localOperationType: row.localOperationType,
      localOperationIds: parseJson<string[]>(row.localOperationIds, []),
      localValues,
      serverValues,
      clientVersion: row.clientVersion,
      serverVersion: row.serverVersion,
      message: row.message,
      detectedAt: row.detectedAt,
      contestedFields: findContestedFields(localValues, serverValues),
      isDeletedOnServer: row.reason === 'deleted_on_server' || !!serverValues?.isDeleted,
      isLocalDelete: row.localOperationType === 'delete',
    };
  };

  /**
   * Marca as operações locais do conflito para que o motor de sincronização não as
   * reenvie. Sem isto o ciclo tentaria empurrar a mesma operação recusada a cada 30
   * segundos, produzindo um conflito novo em cada volta.
   */
  const blockOperations = async (operationIds: string[]) => {
    if (operationIds.length === 0) return;
    await db
      .update(schema.operationLogs)
      .set({ conflictState: 'conflicted' })
      .where(inArray(schema.operationLogs.id, operationIds));
  };

  const abandonOperations = async (operationIds: string[]) => {
    if (operationIds.length === 0) return;
    await db
      .update(schema.operationLogs)
      .set({ conflictState: 'abandoned', isSynced: true })
      .where(inArray(schema.operationLogs.id, operationIds));
  };

  const getConflict = async (conflictId: string): Promise<PendingConflict | undefined> => {
    const row = await db.query.syncConflicts.findFirst({
      where: eq(schema.syncConflicts.id, conflictId),
    });
    return row ? toPendingConflict(row) : undefined;
  };

  const closeConflict = async (conflictId: string, resolution: ConflictResolution) => {
    await db
      .update(schema.syncConflicts)
      .set({ status: 'resolved', resolution, resolvedAt: new Date() })
      .where(eq(schema.syncConflicts.id, conflictId));
  };

  /**
   * Grava uma nova operação local já rebaseada: o payload leva `version = base + 1`,
   * que é a convenção que o motor de sincronização usa para derivar a base enviada ao
   * servidor. Rebasear é o que faz o "manter o meu" funcionar - a edição é reenviada
   * apoiada na versão que o servidor tem *agora*, então passa na checagem de concorrência
   * em vez de conflitar de novo.
   */
  const recordRebasedOperation = async (
    conflict: PendingConflict,
    operationType: 'create' | 'update' | 'delete',
    values: Record<string, any>,
    baseVersion: number,
  ) => {
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, conflict.storyId),
      columns: { lastOperationLog: true, userId: true },
    });
    const nextOperationVersion = (story?.lastOperationLog || 0) + 1;

    await db.insert(schema.operationLogs).values({
      id: createULID(),
      storyId: conflict.storyId,
      userId: story?.userId || 'local_user',
      operationVersion: nextOperationVersion,
      operationType,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      payload: JSON.stringify({ ...values, version: baseVersion + 1 }),
      createdAt: new Date(),
      isSynced: false,
      conflictState: null,
    });

    await db
      .update(schema.stories)
      .set({ lastOperationLog: nextOperationVersion })
      .where(eq(schema.stories.id, conflict.storyId));
  };

  /** Leitura genérica da entidade local, usada ao recriar algo removido no servidor. */
  const readLocalEntity = async (
    entityType: string,
    entityId: string,
  ): Promise<Record<string, any> | undefined> => {
    const table = getEntityTable(entityType);
    if (!table) return undefined;
    const rows = await db
      .select()
      .from(table)
      .where(eq((table as any).id, entityId))
      .limit(1);
    return rows.at(0) as Record<string, any> | undefined;
  };

  /** Escreve valores na entidade local e alinha a versão com a do servidor. */
  const writeEntity = async (
    entityType: string,
    entityId: string,
    values: Record<string, any>,
    version: number,
  ) => {
    const table = getEntityTable(entityType);
    if (!table) {
      console.log(`SyncConflictService: no local table registered for entity type ${entityType}.`);
      return;
    }

    const columns = toEntityColumns(entityType, values);
    await db
      .update(table)
      .set({ ...columns, version, updatedAt: new Date() })
      .where(eq((table as any).id, entityId));
  };

  return {
    async recordConflict(input: RecordConflictInput): Promise<void> {
      await blockOperations(input.localOperationIds);

      // Um conflito por entidade: se já existe um pendente para ela, o novo push apenas
      // traz informação mais fresca do servidor, não uma segunda decisão a tomar.
      const existing = await db.query.syncConflicts.findFirst({
        where: and(
          eq(schema.syncConflicts.storyId, input.storyId),
          eq(schema.syncConflicts.entityType, input.entityType),
          eq(schema.syncConflicts.entityId, input.entityId),
          eq(schema.syncConflicts.status, 'pending'),
        ),
      });

      if (existing) {
        const mergedOperationIds = Array.from(
          new Set([
            ...parseJson<string[]>(existing.localOperationIds, []),
            ...input.localOperationIds,
          ]),
        );
        await db
          .update(schema.syncConflicts)
          .set({
            reason: input.reason,
            localOperationType: input.localOperationType,
            localOperationIds: JSON.stringify(mergedOperationIds),
            localValues: JSON.stringify({
              ...parseJson<Record<string, any>>(existing.localValues, {}),
              ...input.localValues,
            }),
            serverValues:
              input.serverValues === undefined
                ? existing.serverValues
                : JSON.stringify(input.serverValues),
            clientVersion: input.clientVersion ?? existing.clientVersion,
            serverVersion: input.serverVersion ?? existing.serverVersion,
            message: input.message ?? existing.message,
          })
          .where(eq(schema.syncConflicts.id, existing.id));
        entityEventEmitter.emit('sync_conflicts_changed', input.storyId);
        return;
      }

      await db.insert(schema.syncConflicts).values({
        id: createULID(),
        storyId: input.storyId,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        localOperationType: input.localOperationType,
        localOperationIds: JSON.stringify(input.localOperationIds),
        localValues: JSON.stringify(input.localValues),
        serverValues:
          input.serverValues === undefined || input.serverValues === null
            ? null
            : JSON.stringify(input.serverValues),
        clientVersion: input.clientVersion ?? null,
        serverVersion: input.serverVersion ?? null,
        message: input.message ?? null,
        status: 'pending',
        detectedAt: new Date(),
      });

      entityEventEmitter.emit('sync_conflicts_changed', input.storyId);
    },

    async getPendingConflicts(storyId?: string): Promise<PendingConflict[]> {
      const rows = await db.query.syncConflicts.findMany({
        where: storyId
          ? and(
              eq(schema.syncConflicts.status, 'pending'),
              eq(schema.syncConflicts.storyId, storyId),
            )
          : eq(schema.syncConflicts.status, 'pending'),
        orderBy: asc(schema.syncConflicts.detectedAt),
      });
      return rows.map(toPendingConflict);
    },

    async countPendingConflicts(storyId?: string): Promise<number> {
      const rows = await db.query.syncConflicts.findMany({
        where: storyId
          ? and(
              eq(schema.syncConflicts.status, 'pending'),
              eq(schema.syncConflicts.storyId, storyId),
            )
          : eq(schema.syncConflicts.status, 'pending'),
        columns: { id: true },
      });
      return rows.length;
    },

    async resolveKeepLocal(conflictId: string, chosenValues?: Record<string, any>): Promise<void> {
      const conflict = await getConflict(conflictId);
      if (!conflict) {
        console.log(`SyncConflictService: conflict ${conflictId} not found.`);
        return;
      }

      // Sem versão do servidor não há em que rebasear; 0 faz o servidor tratar como
      // last-write-wins, que é o resultado desejado quando ele não informou a versão.
      const baseVersion = conflict.serverVersion ?? 0;
      const values = chosenValues ?? conflict.localValues;

      await abandonOperations(conflict.localOperationIds);

      if (conflict.isLocalDelete) {
        // O usuário excluiu; manter a decisão dele significa reenviar a exclusão sobre a
        // versão atual do servidor.
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { isDeleted: true, deletedAt: new Date() },
          baseVersion + 1,
        );
        await recordRebasedOperation(
          conflict,
          'delete',
          { id: conflict.entityId, isDeleted: true },
          baseVersion,
        );
      } else if (
        conflict.localOperationType === 'create' ||
        conflict.reason === 'not_found' ||
        conflict.reason === 'limit_exceeded'
      ) {
        // A entidade não existe no servidor - por a operação local original já ser um
        // `create` (qualquer que seja o motivo recusado - `not_found` de uma dependência
        // ausente, `limit_exceeded` do teto do plano, ou até `unknown` de uma falha de
        // validação no servidor), ou por ter sido removida lá depois (`not_found` numa
        // operação que era `update`/`reorder`). Em todos esses casos "manter a minha versão"
        // tem que reenviar como `create`, não `update`: um `update` contra uma entidade que
        // o servidor nunca teve voltaria como um novo conflito `not_found` em vez de dar à
        // tentativa uma chance real de passar - exatamente o loop que deixava uma
        // GalleryRelation presa pra sempre quando seu dono ainda não existia no servidor.
        const local = await readLocalEntity(conflict.entityType, conflict.entityId);
        await recordRebasedOperation(
          conflict,
          'create',
          { ...(local ?? {}), ...values, isDeleted: false },
          0,
        );
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { ...values, isDeleted: false, deletedAt: null },
          1,
        );
      } else {
        // Inclui o caso `deleted_on_server`: mandar `isDeleted: false` restaura a entidade
        // no servidor junto com os valores que o usuário escreveu.
        const restoreFields = conflict.isDeletedOnServer ? { isDeleted: false } : {};
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { ...values, ...restoreFields, deletedAt: null },
          baseVersion + 1,
        );
        await recordRebasedOperation(
          conflict,
          'update',
          { ...values, ...restoreFields },
          baseVersion,
        );
      }

      await closeConflict(conflictId, chosenValues ? 'merge' : 'keep_local');
      entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      entityEventEmitter.emit('operation_log_updated', conflict.storyId);
    },

    async resolveKeepServer(conflictId: string): Promise<void> {
      const conflict = await getConflict(conflictId);
      if (!conflict) {
        console.log(`SyncConflictService: conflict ${conflictId} not found.`);
        return;
      }

      await abandonOperations(conflict.localOperationIds);

      if (!conflict.serverValues) {
        // O servidor não tem a entidade. Aceitar isso é removê-la aqui - e sem gravar
        // operação, porque não há nada a informar a quem já não a tem.
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { isDeleted: true, deletedAt: new Date() },
          (conflict.serverVersion ?? 0) + 1,
        );
      } else {
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          conflict.serverValues,
          conflict.serverVersion ?? conflict.serverValues.version ?? 1,
        );
      }

      await closeConflict(conflictId, 'keep_server');
      entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      entityEventEmitter.emit('operation_log_updated', conflict.storyId);
    },

    async dismissConflict(conflictId: string): Promise<void> {
      const conflict = await getConflict(conflictId);
      // Without this, dismissing just hides the conflict from the pending list while its
      // operations stay `conflictState: 'conflicted'` forever - excluded from every future
      // push batch (see `getPushableOperations`'s `isNull(conflictState)` filter) with no way
      // left to resolve or retry them.
      if (conflict) {
        await abandonOperations(conflict.localOperationIds);
      }
      await db
        .update(schema.syncConflicts)
        .set({ status: 'dismissed', resolvedAt: new Date() })
        .where(eq(schema.syncConflicts.id, conflictId));
      if (conflict) {
        entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      }
    },
  };
};
