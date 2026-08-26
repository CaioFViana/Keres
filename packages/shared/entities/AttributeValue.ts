import type { StorySchemaEntityType } from '../metadata/StorySchemaEntityType';

/**
 * The value of a custom attribute on a specific entity. `entityId` is a polymorphic FK (it points
 * at `characters.id`/`locations.id`/etc according to `entityType`), the same pattern already used
 * by `NoteRelation.relationId`/`TagRelation.relationId`/`GalleryRelation.ownerId`.
 *
 * `value` is always plain text regardless of `StorySchemaField.type` - see
 * `attributeValueCodec.ts` for consistent encoding/decoding (number/boolean are never compared as
 * raw text against a typed value, which breaks on Postgres).
 */
export interface AttributeValue {
  id: string;
  /** Denormalised from the field, for queries/indexes without a join - the same pattern as other tables. */
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
