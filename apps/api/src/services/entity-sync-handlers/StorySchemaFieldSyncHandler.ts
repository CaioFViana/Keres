import {
  AttributeType,
  CreateStorySchemaFieldDataSchema,
  CreateStorySchemaFieldDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialStorySchemaFieldSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../../db';
import { storySchemaFields } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class StorySchemaFieldSyncHandler extends BaseSyncEntityHandler<
  typeof CreateStorySchemaFieldDataSchema,
  typeof PartialStorySchemaFieldSchema
> {
  entityName = 'StorySchemaField';

  constructor() {
    super(
      'storySchemaFields',
      'id',
      'version',
      CreateStorySchemaFieldDataSchema,
      PartialStorySchemaFieldSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateStorySchemaFieldDataType = this.createSchema.parse(update.data);

    const existingField = await db.query.storySchemaFields.findFirst({
      where: and(
        eq(storySchemaFields.storyId, storyId),
        eq(storySchemaFields.entityType, validatedData.entityType),
        eq(storySchemaFields.key, validatedData.key),
        eq(storySchemaFields.isDeleted, false),
      ),
    });

    if (existingField) {
      throw new Error(
        `Conflict: Attribute with key "${validatedData.key}" already exists for ${validatedData.entityType} in story ${storyId}.`,
      );
    }

    if (validatedData.type === AttributeType.ENTITY && !validatedData.targetEntityType) {
      throw new Error('Entity attributes require a target entity type.');
    }

    await db.insert(storySchemaFields).values({
      id: update.id!,
      storyId,
      entityType: validatedData.entityType,
      name: validatedData.name,
      key: validatedData.key,
      description: validatedData.description,
      type: validatedData.type,
      targetEntityType: validatedData.targetEntityType,
      isRequired: validatedData.isRequired,
      defaultValue: validatedData.defaultValue,
      order: validatedData.order,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // entityType e key são imutáveis após a criação: AttributeValue referencia o campo por
    // fieldId (não por key), então nada quebraria tecnicamente, mas mudar o tipo de entidade ou
    // a chave por baixo de valores já salvos os deixaria com um rótulo/tipo incoerente sem
    // nenhum aviso - a UI de gerenciamento nunca oferece essa opção, e o servidor não confia
    // apenas nisso: ignora essas duas chaves aqui mesmo se um cliente antigo/adulterado mandar.
    const changes = { ...update.changes };
    delete changes.entityType;
    delete changes.key;
    delete changes.type;
    delete changes.targetEntityType;

    await super.update(userId, storyId, { ...update, changes }, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const alreadyDeleted = !!currentEntity.isDeleted;
    await super.delete(userId, storyId, update, currentEntity);

    if (alreadyDeleted) {
      // Reenvio idempotente da mesma exclusão - a mutação de key já rodou da primeira vez.
      return;
    }

    // Libera o slot da constraint unique(storyId, entityType, key), que não é filtrada por
    // isDeleted - sem isso, recriar um atributo com a mesma chave depois de apagar o antigo
    // falharia contra a linha tombstone. Só afeta esta própria linha (nunca lido de volta por
    // ninguém além desta constraint), então não precisa ser propagado a outros clientes.
    //
    // Cascata para AttributeValue é responsabilidade do CLIENTE (StorySchemaFieldService.
    // deleteField), não daqui: uma mutação direta em SQL nesta tabela não passa pelo
    // operationLog, então outros dispositivos nunca saberiam da cascata via pull - o cliente
    // precisa mandar exclusões explícitas de AttributeValue no mesmo lote, cada uma seguindo o
    // caminho normal (AttributeValueSyncHandler.delete), pra sincronizar corretamente.
    await db
      .update(storySchemaFields)
      .set({ key: sql`${storySchemaFields.key} || '__deleted_' || ${ulid()}` })
      .where(eq(storySchemaFields.id, update.id!));
  }
}
