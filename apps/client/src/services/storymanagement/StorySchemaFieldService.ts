import { StorySchemaEntityType } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { attributeValues, StorySchemaFieldInsert, storySchemaFields, StorySchemaFieldSelect } from '../../db/schema';
import { Create, createULID, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface StorySchemaFieldService {
  getFieldsByStoryAndEntityType(storyId: string, entityType: StorySchemaEntityType): Promise<StorySchemaFieldSelect[]>;
  getById(fieldId: string): Promise<StorySchemaFieldSelect | undefined>;
  createField(currentUserId: string, fieldData: Create<StorySchemaFieldInsert>): Promise<StorySchemaFieldSelect>;
  updateField(
    currentUserId: string,
    fieldId: string,
    fieldData: Partial<Pick<StorySchemaFieldInsert, 'name' | 'description' | 'isRequired' | 'defaultValue' | 'order'>>
  ): Promise<void>;
  deleteField(currentUserId: string, fieldId: string): Promise<void>;
}

export const createStorySchemaFieldService = (db: AppDrizzleClient): StorySchemaFieldService => {
  const serverService = createServerService(db);
  return {
    async getFieldsByStoryAndEntityType(storyId, entityType): Promise<StorySchemaFieldSelect[]> {
      return db.select().from(storySchemaFields)
        .where(and(
          eq(storySchemaFields.storyId, storyId),
          eq(storySchemaFields.entityType, entityType),
          eq(storySchemaFields.isDeleted, false)
        ))
        .orderBy(asc(storySchemaFields.order))
        .all();
    },

    async getById(fieldId: string): Promise<StorySchemaFieldSelect | undefined> {
      return db.query.storySchemaFields.findFirst({
        where: and(eq(storySchemaFields.id, fieldId), eq(storySchemaFields.isDeleted, false)),
      });
    },

    async createField(currentUserId: string, fieldData: Create<StorySchemaFieldInsert>): Promise<StorySchemaFieldSelect> {
      // Checagem local antes de gravar: sem isto, uma chave duplicada só falharia lá na frente,
      // como um erro de sync opaco em vez de um erro de formulário imediato - Tag/Suggestion não
      // fazem essa checagem hoje, mas aqui uma colisão de chave (frequentemente auto-derivada do
      // nome de exibição) é um caminho de usuário bem mais provável.
      const existing = await db.query.storySchemaFields.findFirst({
        where: and(
          eq(storySchemaFields.storyId, fieldData.storyId),
          eq(storySchemaFields.entityType, fieldData.entityType),
          eq(storySchemaFields.key, fieldData.key),
          eq(storySchemaFields.isDeleted, false)
        ),
      });
      if (existing) {
        throw new Error(`An attribute with key "${fieldData.key}" already exists for ${fieldData.entityType} in this story.`);
      }

      const newField = prepareNewEntityData<StorySchemaFieldInsert>(fieldData);
      const result = await db.insert(storySchemaFields).values(newField).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newField.storyId, currentUserId);
      await recordLocalOperation(db, newField.storyId, userIdToLog, 'create', 'StorySchemaField', newField.id, { ...result });
      entityEventEmitter.emit('story_schema_field_changed', newField.storyId, newField.entityType);

      return result;
    },

    async updateField(currentUserId, fieldId, fieldData): Promise<void> {
      const original = await db.query.storySchemaFields.findFirst({ where: eq(storySchemaFields.id, fieldId) });
      if (!original) {
        throw new Error(`Attribute field with ID ${fieldId} not found for update.`);
      }

      const [updated] = await db.update(storySchemaFields)
        .set({ ...fieldData, updatedAt: new Date(), version: sql`${storySchemaFields.version} + 1` })
        .where(eq(storySchemaFields.id, fieldId))
        .returning({ id: storySchemaFields.id, storyId: storySchemaFields.storyId, entityType: storySchemaFields.entityType, version: storySchemaFields.version });

      if (!updated) {
        throw new Error(`Failed to update attribute field ${fieldId}.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updated.storyId, currentUserId);
      await recordLocalOperation(db, updated.storyId, userIdToLog, 'update', 'StorySchemaField', fieldId, {
        ...fieldData,
        version: updated.version,
      });
      entityEventEmitter.emit('story_schema_field_changed', updated.storyId, updated.entityType);
    },

    async deleteField(currentUserId: string, fieldId: string): Promise<void> {
      const field = await db.query.storySchemaFields.findFirst({ where: eq(storySchemaFields.id, fieldId) });
      if (!field) {
        console.warn(`Attempted to delete non-existent attribute field ${fieldId}.`);
        return;
      }
      if (field.isDeleted) {
        // Já apagado (reenvio idempotente) - a mutação de key e a cascata já rodaram.
        return;
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, field.storyId, currentUserId);
      const now = new Date();

      // Muta a key no soft-delete pra liberar o slot de unique(storyId, entityType, key) - a
      // constraint local (e a do servidor) não é filtrada por isDeleted, então recriar um campo
      // com a mesma chave depois de apagar o antigo esbarraria na linha tombstone. Só precisa
      // valer localmente (o servidor faz sua própria mutação independente ao processar o mesmo
      // delete, ver StorySchemaFieldSyncHandler) - ninguém nunca lê essa key mutada de volta.
      const mangledKey = `${field.key}__deleted_${createULID()}`;
      const [updatedField] = await db.update(storySchemaFields)
        .set({ key: mangledKey, isDeleted: true, deletedAt: now, updatedAt: now, version: sql`${storySchemaFields.version} + 1` })
        .where(eq(storySchemaFields.id, fieldId))
        .returning({ id: storySchemaFields.id, version: storySchemaFields.version });

      if (!updatedField) {
        throw new Error(`Failed to delete attribute field ${fieldId}.`);
      }

      await recordLocalOperation(db, field.storyId, userIdToLog, 'delete', 'StorySchemaField', fieldId, {
        id: fieldId,
        isDeleted: true,
        version: updatedField.version,
      });

      // Cascata: um AttributeValue órfão (fieldId apontando pra um campo que não existe mais)
      // não tem type/label pra se renderizar - diferente de outras relações no app, que ficam
      // órfãs inertemente sem problema quando a entidade dona é excluída. Cada valor precisa da
      // sua PRÓPRIA operação registrada (não uma mutação SQL direta) pra que o pull de outros
      // dispositivos realmente saiba da exclusão - ver o comentário em
      // StorySchemaFieldSyncHandler.delete() sobre por que a cascata não pode viver só no
      // servidor.
      const liveValues = await db.select({ id: attributeValues.id, version: attributeValues.version })
        .from(attributeValues)
        .where(and(eq(attributeValues.fieldId, fieldId), eq(attributeValues.isDeleted, false)))
        .all();

      for (const value of liveValues) {
        const [updatedValue] = await db.update(attributeValues)
          .set({ isDeleted: true, deletedAt: now, updatedAt: now, version: sql`${attributeValues.version} + 1` })
          .where(eq(attributeValues.id, value.id))
          .returning({ id: attributeValues.id, version: attributeValues.version });

        if (!updatedValue) {
          continue;
        }

        await recordLocalOperation(db, field.storyId, userIdToLog, 'delete', 'AttributeValue', value.id, {
          id: value.id,
          isDeleted: true,
          version: updatedValue.version,
        });
      }

      entityEventEmitter.emit('story_schema_field_changed', field.storyId, field.entityType);
    },
  };
};

