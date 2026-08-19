import {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  getSimpleDisplayName,
  omitSyncImmutableFields,
  StoryUpdate,
  SYNC_CLIENT_IMMUTABLE_FIELD_SET,
  SyncConflictReason,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, inArray, SQL, sql } from 'drizzle-orm';
import { PgTableWithColumns } from 'drizzle-orm/pg-core';
import { z } from 'zod'; // Import Zod
import { db } from '../../db';
import * as dbSchema from '../../db/schema'; // Import the entire schema

/**
 * Recusa de uma operação que o *usuário* pode resolver, em oposição a um erro de
 * programação ou de infraestrutura.
 *
 * Existe para que o `SyncService` consiga distinguir os dois casos: um conflito volta
 * ao cliente descrito na resposta do push (que então abre a tela de resolução), e não
 * como um 500 que derruba o lote inteiro e não diz ao cliente o que fazer.
 */
export class SyncConflictError extends Error {
  readonly reason: SyncConflictReason;
  readonly clientVersion?: number;
  readonly serverVersion?: number;

  constructor(
    reason: SyncConflictReason,
    message: string,
    versions?: { clientVersion?: number; serverVersion?: number },
  ) {
    super(message);
    this.name = 'SyncConflictError';
    this.reason = reason;
    this.clientVersion = versions?.clientVersion;
    this.serverVersion = versions?.serverVersion;
  }
}

export interface SyncEntityHandler {
  entityName: string;
  findById(id: string): Promise<any | undefined>;
  create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;
  update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void>;
  delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void>;
  checkOwnership(entity: any, userId: string): boolean;
  checkBelongsToStory(entity: any, storyId: string): boolean;
  /** Payload que o log deve retransmitir: o que foi gravado, não o JSON cru do cliente. */
  sanitizePayloadForLog(update: StoryUpdate, actingUserId: string): Record<string, any>;
  /** Create reenviado: o payload sanitizado descreve a mesma linha que já existe? */
  createPayloadMatches(existing: any, incomingData: Record<string, any>): boolean;
  /** Conta linhas não excluídas desta entidade nas histórias dadas. Usado por TierEnforcementService. */
  countForStoryIds(storyIds: string[]): Promise<number>;
  /** Linhas excluídas (tombstones), opcionalmente restritas a uma história. Usado por AdminRecoveryService. */
  findDeleted(storyId?: string): Promise<
    Array<{
      id: string;
      storyId: string | null;
      deletedAt: Date | null;
      version: number;
      name: string | null;
      /** Linha crua para enriquecimento composto no AdminRecoveryService (não vai na resposta HTTP). */
      row: Record<string, unknown>;
    }>
  >;
}

export abstract class BaseSyncEntityHandler<
  CreateType extends z.ZodType<Record<string, any>>,
  UpdateType extends z.ZodType<Record<string, any>>,
> implements SyncEntityHandler
{
  abstract entityName: string;
  protected _tableName: keyof typeof dbSchema; // Store the table name as a string
  protected idColumnName: string;
  protected storyIdColumnName?: string;
  protected userIdColumnName?: string;
  protected versionColumnName: string;
  protected isDeletedColumnName?: string;
  protected deletedAtColumnName?: string;
  protected createSchema: CreateType; // Zod schema for creation
  protected updateSchema: UpdateType; // Zod schema for updates

  // Getter to dynamically retrieve the table object
  protected get table(): PgTableWithColumns<any> {
    const table = dbSchema[this._tableName];
    if (!table) {
      throw new Error(`Table '${this._tableName}' not found in schema.`);
    }
    return table as PgTableWithColumns<any>;
  }

  constructor(
    tableName: keyof typeof dbSchema, // Accept table name as string
    idColumnName: string,
    versionColumnName: string,
    createSchema: CreateType, // New: Zod schema for creation
    updateSchema: UpdateType, // New: Zod schema for updates
    options?: {
      storyIdColumnName?: string;
      userIdColumnName?: string;
      isDeletedColumnName?: string;
      deletedAtColumnName?: string;
    },
  ) {
    this._tableName = tableName;
    this.idColumnName = idColumnName;
    this.versionColumnName = versionColumnName;
    this.createSchema = createSchema;
    this.updateSchema = updateSchema;
    this.storyIdColumnName = options?.storyIdColumnName;
    this.userIdColumnName = options?.userIdColumnName;
    this.isDeletedColumnName = options?.isDeletedColumnName;
    this.deletedAtColumnName = options?.deletedAtColumnName;
  }

  async findById(id: string): Promise<any | undefined> {
    const results = await db
      .select()
      .from(this.table)
      .where(eq((this.table as any)[this.idColumnName], id))
      .limit(1);
    return results.at(0);
  }

  async countForStoryIds(storyIds: string[]): Promise<number> {
    if (!this.storyIdColumnName || storyIds.length === 0) {
      return 0;
    }
    const conditions = [inArray((this.table as any)[this.storyIdColumnName], storyIds)];
    if (this.isDeletedColumnName) {
      conditions.push(eq((this.table as any)[this.isDeletedColumnName], false));
    }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  async findDeleted(storyId?: string): Promise<
    Array<{
      id: string;
      storyId: string | null;
      deletedAt: Date | null;
      version: number;
      name: string | null;
      row: Record<string, unknown>;
    }>
  > {
    if (!this.isDeletedColumnName) {
      return [];
    }
    const conditions = [eq((this.table as any)[this.isDeletedColumnName], true)];
    if (storyId && this.storyIdColumnName) {
      conditions.push(eq((this.table as any)[this.storyIdColumnName], storyId));
    }
    const rows = await db
      .select()
      .from(this.table)
      .where(and(...conditions));
    return rows.map((r: any) => {
      const row = r as Record<string, unknown>;
      return {
        id: r[this.idColumnName],
        storyId: this.storyIdColumnName ? r[this.storyIdColumnName] : null,
        deletedAt: this.deletedAtColumnName ? r[this.deletedAtColumnName] : null,
        version: r[this.versionColumnName],
        name: getSimpleDisplayName(this.entityName, row),
        row,
      };
    });
  }

  abstract create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // `isDeleted`/`deletedAt` são tratados fora da validação porque não são uma edição
    // comum de campo: são a *restauração* de uma entidade excluída. Extrair antes de
    // validar evita depender de cada schema de entidade aceitar esses campos.
    const incomingChanges: Record<string, any> = { ...update.changes };
    const restoreRequested = incomingChanges.isDeleted === false;
    delete incomingChanges.isDeleted;
    delete incomingChanges.deletedAt;

    this.assertNoImmutableFieldWrites(incomingChanges);

    const isDeletedOnServer = !!(
      this.isDeletedColumnName && currentEntity[this.isDeletedColumnName]
    );
    if (isDeletedOnServer && !restoreRequested) {
      // A entidade foi excluída aqui enquanto o cliente a editava offline. Aplicar a
      // edição em silêncio gravaria o trabalho do usuário numa linha que ninguém mais
      // vê, então devolvemos o caso para ele decidir (restaurar ou aceitar a exclusão).
      throw new SyncConflictError(
        'deleted_on_server',
        `Conflict: ${this.entityName} ${update.id} was deleted on the server.`,
        {
          clientVersion: update.changes.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }

    this.checkVersionConflict(
      update.changes.version,
      currentEntity[this.versionColumnName],
      update.id!,
    );

    // Validate incoming changes against the update schema.
    const validatedChanges: z.infer<UpdateType> = this.updateSchema.parse(incomingChanges);
    this.stripImmutableFields(validatedChanges as Record<string, any>);
    this.keepOnlyProvidedKeys(validatedChanges as Record<string, any>, incomingChanges);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    const changes: Record<string, any> = {
      ...validatedChanges, // Use validated changes
      updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      [this.versionColumnName]:
        sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
    };

    if (restoreRequested && this.isDeletedColumnName && this.deletedAtColumnName) {
      changes[this.isDeletedColumnName] = false;
      changes[this.deletedAtColumnName] = null;
    }

    // The `checkVersionConflict` above only compares against the version this request read
    // before its transaction started - it can't see a second transaction that reads the same
    // base version and commits first. Guarding the write itself with `version = <base>` closes
    // that gap: Postgres serializes the two UPDATEs via row lock, the loser's WHERE no longer
    // matches once the winner has committed a new version, and `.returning()` coming back empty
    // is how we tell "genuinely raced" apart from "row just doesn't exist" (already ruled out by
    // `currentEntity` being loaded above).
    const [updated] = await db
      .update(this.table)
      .set(changes)
      .where(
        and(
          eq((this.table as any)[this.idColumnName], update.id!),
          eq((this.table as any)[this.versionColumnName], currentEntity[this.versionColumnName]),
        ),
      )
      .returning({ id: (this.table as any)[this.idColumnName] });

    if (!updated) {
      throw new SyncConflictError(
        'version_conflict',
        `Conflict: ${this.entityName} ${update.id} was modified concurrently.`,
        {
          clientVersion: update.changes.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    if (!this.isDeletedColumnName || !this.deletedAtColumnName) {
      throw new Error(
        `Delete not supported for entity ${this.entityName}: missing isDeletedColumnName or deletedAtColumnName.`,
      );
    }

    if (currentEntity[this.isDeletedColumnName]) {
      // Já está excluída: reenviar a mesma exclusão (porque a resposta anterior se
      // perdeu, por exemplo) não é conflito, é a operação já ter surtido efeito.
      return;
    }

    this.checkVersionConflict(update.version!, currentEntity[this.versionColumnName], update.id!);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    const [deleted] = await db
      .update(this.table)
      .set({
        [this.isDeletedColumnName]: true,
        [this.deletedAtColumnName]: clientOperationTime, // Use client's operationTime for deletedAt
        [this.versionColumnName]:
          sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
        updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      })
      .where(
        and(
          eq((this.table as any)[this.idColumnName], update.id!),
          eq((this.table as any)[this.versionColumnName], currentEntity[this.versionColumnName]),
        ),
      )
      .returning({ id: (this.table as any)[this.idColumnName] });

    if (!deleted) {
      throw new SyncConflictError(
        'version_conflict',
        `Conflict: ${this.entityName} ${update.id} was modified concurrently.`,
        {
          clientVersion: update.version,
          serverVersion: currentEntity[this.versionColumnName],
        },
      );
    }
  }

  /** Rejeita horários no futuro (fora de 1s de folga para diferença de relógio). */
  protected parseOperationTime(operationTime: string | undefined): Date {
    const clientOperationTime = operationTime ? new Date(operationTime) : new Date();
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) {
      throw new SyncConflictError(
        'validation',
        `Operation time ${operationTime} cannot be in the future.`,
      );
    }
    return clientOperationTime;
  }

  checkOwnership(entity: any, userId: string): boolean {
    if (!this.userIdColumnName) {
      // If there's no userIdColumnName, ownership might not be applicable or checked elsewhere
      return true;
    }
    return entity[this.userIdColumnName] === userId;
  }

  checkBelongsToStory(entity: any, storyId: string): boolean {
    if (!this.storyIdColumnName) {
      // If there's no storyIdName, it might be a top-level entity like Story itself
      return true;
    }
    return entity[this.storyIdColumnName] === storyId;
  }

  /**
   * Controle de concorrência otimista: a operação só é aceita se o cliente a construiu
   * sobre a versão que o servidor tem agora.
   *
   * A comparação é de igualdade, não `<`. Sem versão o servidor recusa: last-write-wins
   * deixava um cliente adulterado sobrescrever qualquer edição concorrente.
   */
  protected checkVersionConflict(
    clientVersion: number | undefined,
    serverVersion: number,
    entityId: string,
  ): void {
    if (clientVersion === undefined || clientVersion === null) {
      throw new SyncConflictError(
        'validation',
        `Conflict: ${this.entityName} ${entityId} is missing a base version.`,
      );
    }

    if (clientVersion === serverVersion) {
      return;
    }

    throw new SyncConflictError(
      'version_conflict',
      `Conflict: ${this.entityName} ${entityId} is outdated. Client base version ${clientVersion} != server version ${serverVersion}.`,
      { clientVersion, serverVersion },
    );
  }

  sanitizePayloadForLog(update: StoryUpdate, actingUserId: string): Record<string, any> {
    if (update.type === 'create') {
      const parsed = this.createSchema.parse(update.data) as Record<string, any>;
      return this.payloadForLog(parsed, actingUserId);
    }
    if (update.type === 'update') {
      const incoming: Record<string, any> = { ...(update as UpdateStoryUpdate).changes };
      const restoreRequested = incoming.isDeleted === false;
      delete incoming.isDeleted;
      delete incoming.deletedAt;
      const parsed = this.updateSchema.parse(incoming) as Record<string, any>;
      this.keepOnlyProvidedKeys(parsed, incoming);
      const payload = this.payloadForLog(parsed, actingUserId);
      if (restoreRequested) {
        payload.isDeleted = false;
        payload.deletedAt = null;
      }
      return payload;
    }
    if (update.type === 'delete') {
      return { id: update.id };
    }
    if (update.type === 'reorder') {
      return {
        reorderItems: (update as { reorderItems?: unknown }).reorderItems,
        reorderTarget: (update as { reorderTarget?: unknown }).reorderTarget,
        schemaEntityType: (update as { schemaEntityType?: unknown }).schemaEntityType,
      };
    }
    return {};
  }

  createPayloadMatches(existing: any, incomingData: Record<string, any>): boolean {
    let parsed: Record<string, any>;
    try {
      parsed = this.createSchema.parse(incomingData) as Record<string, any>;
    } catch {
      return false;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (SYNC_CLIENT_IMMUTABLE_FIELD_SET.has(key)) continue;
      if (key === 'userId' || key === 'authorUserId') continue;
      if (value === undefined) continue;
      const current = existing?.[key];
      if (current instanceof Date) {
        const incomingTime =
          value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
        if (current.getTime() !== incomingTime) return false;
        continue;
      }
      if (JSON.stringify(current ?? null) !== JSON.stringify(value ?? null)) {
        return false;
      }
    }
    return true;
  }

  /**
   * `storyId`/`userId`/`id` no body de um update são transplante ou roubo de identidade.
   * `version` é a base do OCC e fica de fora desta checagem.
   */
  protected assertNoImmutableFieldWrites(changes: Record<string, any>): void {
    const attempted = ['id', 'storyId', 'userId', 'authorUserId', 'lastOperationVersion'].filter(
      (field) => changes[field] !== undefined,
    );
    if (attempted.length === 0) return;
    throw new SyncConflictError(
      'unauthorized',
      `Cannot write server-managed field(s) ${attempted.join(', ')} on ${this.entityName}.`,
    );
  }

  /** Zod `.partial()` keeps `.default()` active; without this, a name-only patch would reset isFavorite. */
  protected keepOnlyProvidedKeys(parsed: Record<string, any>, provided: Record<string, any>): void {
    for (const key of Object.keys(parsed)) {
      if (!(key in provided)) delete parsed[key];
    }
  }

  protected stripImmutableFields(changes: Record<string, any>): void {
    for (const field of SYNC_CLIENT_IMMUTABLE_FIELD_SET) {
      delete changes[field];
    }
  }

  private payloadForLog(parsed: Record<string, any>, actingUserId: string): Record<string, any> {
    const sanitized = omitSyncImmutableFields(parsed);
    if (this.entityName === 'Favorite') {
      sanitized.userId = actingUserId;
    }
    if (this.entityName === 'Comment') {
      sanitized.authorUserId = actingUserId;
    }
    if (this.entityName === 'Story') {
      delete sanitized.userId;
    }
    return sanitized;
  }
}
