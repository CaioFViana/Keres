import type { AttributeType } from '../metadata/AttributeType';
import type { StorySchemaEntityType } from '../metadata/StorySchemaEntityType';

/**
 * The definition of a custom attribute, shared by every entity of `entityType` within `storyId` -
 * never per individual instance. `key` is immutable after creation (only
 * `name`/`description`/`isRequired`/`defaultValue`/`order` are editable); `AttributeValue`
 * references this row by `fieldId`, so renaming `name` never disconnects already-saved values.
 */
export interface StorySchemaField {
  id: string;
  storyId: string;
  entityType: StorySchemaEntityType;
  /** Display name, editable. */
  name: string;
  /** lowercase snake_case, unique within (storyId, entityType), immutable after creation. */
  key: string;
  description: string | null;
  type: AttributeType;
  /** Alvo fixo de um atributo ENTITY; imutÃ¡vel apÃ³s a criaÃ§Ã£o, como key e entityType. */
  targetEntityType: StorySchemaEntityType | null;
  isRequired: boolean;
  /** Sempre texto puro, igual a `AttributeValue.value` - ver `attributeValueCodec.ts`. */
  defaultValue: string | null;
  /** Display order in forms/details, ascending. Not editable. Not important enough to reorder! */
  order: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
