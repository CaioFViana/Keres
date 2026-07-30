import { CreateStoryUpdate, DeleteStoryUpdate, SyncConflictReason, UpdateStoryUpdate } from '@keres/shared';
import { SQL, eq, sql } from 'drizzle-orm';
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
    versions?: { clientVersion?: number; serverVersion?: number }
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
  update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void>;
  delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void>;
  checkOwnership(entity: any, userId: string): boolean;
  checkBelongsToStory(entity: any, storyId: string): boolean;
}

export abstract class BaseSyncEntityHandler<CreateType extends z.ZodType<Record<string, any>>, UpdateType extends z.ZodType<Record<string, any>>> implements SyncEntityHandler {
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
    }
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
    const results = await db.select()
      .from(this.table)
      .where(eq((this.table as any)[this.idColumnName], id))
      .limit(1);
    return results.at(0);
  }

  abstract create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void>;

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    // `isDeleted`/`deletedAt` são tratados fora da validação porque não são uma edição
    // comum de campo: são a *restauração* de uma entidade excluída. Extrair antes de
    // validar evita depender de cada schema de entidade aceitar esses campos.
    const incomingChanges: Record<string, any> = { ...update.changes };
    const restoreRequested = incomingChanges.isDeleted === false;
    delete incomingChanges.isDeleted;
    delete incomingChanges.deletedAt;

    const isDeletedOnServer = !!(this.isDeletedColumnName && currentEntity[this.isDeletedColumnName]);
    if (isDeletedOnServer && !restoreRequested) {
      // A entidade foi excluída aqui enquanto o cliente a editava offline. Aplicar a
      // edição em silêncio gravaria o trabalho do usuário numa linha que ninguém mais
      // vê, então devolvemos o caso para ele decidir (restaurar ou aceitar a exclusão).
      throw new SyncConflictError(
        'deleted_on_server',
        `Conflict: ${this.entityName} ${update.id} was deleted on the server.`,
        { clientVersion: update.changes.version, serverVersion: currentEntity[this.versionColumnName] }
      );
    }

    this.checkVersionConflict(update.changes.version, currentEntity[this.versionColumnName], update.id!);

    // Validate incoming changes against the update schema.
    const validatedChanges: z.infer<UpdateType> = this.updateSchema.parse(incomingChanges);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    const changes: Record<string, any> = {
      ...validatedChanges, // Use validated changes
      updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      [this.versionColumnName]: sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
    };

    if (restoreRequested && this.isDeletedColumnName && this.deletedAtColumnName) {
      changes[this.isDeletedColumnName] = false;
      changes[this.deletedAtColumnName] = null;
    }

    await db.update(this.table)
      .set(changes)
      .where(eq((this.table as any)[this.idColumnName], update.id!));
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    if (!this.isDeletedColumnName || !this.deletedAtColumnName) {
      throw new Error(`Delete not supported for entity ${this.entityName}: missing isDeletedColumnName or deletedAtColumnName.`);
    }

    if (currentEntity[this.isDeletedColumnName]) {
      // Já está excluída: reenviar a mesma exclusão (porque a resposta anterior se
      // perdeu, por exemplo) não é conflito, é a operação já ter surtido efeito.
      return;
    }

    this.checkVersionConflict(update.version!, currentEntity[this.versionColumnName], update.id!);

    // Validate operationTime is not in the future
    const clientOperationTime = this.parseOperationTime(update.operationTime);

    await db.update(this.table)
      .set({
        [this.isDeletedColumnName]: true,
        [this.deletedAtColumnName]: clientOperationTime, // Use client's operationTime for deletedAt
        [this.versionColumnName]: sql`${(this.table as any)[this.versionColumnName]} + 1` as SQL<number>,
        updatedAt: clientOperationTime, // Use client's operationTime for updatedAt
      })
      .where(eq((this.table as any)[this.idColumnName], update.id!));
  }

  /** Rejeita horários no futuro (fora de 1s de folga para diferença de relógio). */
  protected parseOperationTime(operationTime: string | undefined): Date {
    const clientOperationTime = operationTime ? new Date(operationTime) : new Date();
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) {
      throw new SyncConflictError(
        'validation',
        `Operation time ${operationTime} cannot be in the future.`
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
   * A comparação é de igualdade, não `<`. Com `<` uma edição feita sobre uma base
   * *mais nova* que a do servidor passava sem checagem, o que na prática deixava
   * qualquer conflito escapar.
   */
  protected checkVersionConflict(clientVersion: number | undefined, serverVersion: number, entityId: string): void {
    if (clientVersion === undefined || clientVersion === null) {
      // Cliente que não informa a base abre mão do controle de concorrência: last-write-wins.
      return;
    }

    if (clientVersion === serverVersion) {
      return;
    }

    // Tolerância para clientes anteriores a esta mudança, que enviavam a versão já
    // incrementada (base + 1) em vez da base. Eles continuam funcionando em last-write-wins;
    // apenas não ganham detecção de conflito.
    if (clientVersion === serverVersion + 1) {
      return;
    }

    throw new SyncConflictError(
      'version_conflict',
      `Conflict: ${this.entityName} ${entityId} is outdated. Client base version ${clientVersion} != server version ${serverVersion}.`,
      { clientVersion, serverVersion }
    );
  }
}
