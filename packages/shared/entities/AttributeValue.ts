import type { StorySchemaEntityType } from '../metadata/StorySchemaEntityType';

/**
 * Valor de um atributo customizado numa entidade específica. `entityId` é uma FK polimórfica
 * (aponta pra `characters.id`/`locations.id`/etc conforme `entityType`), mesmo padrão já usado
 * por `NoteRelation.relationId`/`TagRelation.relationId`/`GalleryRelation.ownerId`.
 *
 * `value` é sempre texto puro independente de `StorySchemaField.type` - ver
 * `attributeValueCodec.ts` pra codificação/decodificação consistente (number/boolean nunca
 * comparados como texto cru contra um valor tipado, isso quebra no Postgres).
 */
export interface AttributeValue {
  id: string;
  /** Denormalizado do campo, para consultas/índices sem join - mesmo padrão de outras tabelas. */
  storyId: string;
  entityType: StorySchemaEntityType;
  entityId: string;
  /** FK para `StorySchemaField.id`. */
  fieldId: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
