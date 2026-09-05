import { AttributeType, isSuggestionAttributeType } from '@keres/shared';
import type { FieldType, EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { StorySchemaFieldSelect } from '../db/schema';

/** Distinguishes a custom-field search key (`custom:<fieldId>`) from a native column name. */
export const CUSTOM_FIELD_METADATA_PREFIX = 'custom:';

function mapAttributeTypeToFieldType(type: string): FieldType {
  switch (type) {
    case AttributeType.NUMBER:
      return 'number';
    case AttributeType.BOOLEAN:
      return 'boolean';
    case AttributeType.DATE:
      return 'date';
    case AttributeType.STORY_DATE:
      return 'story_date';
    case AttributeType.ENTITY:
      return 'entity';
    default:
      // TEXT, LONG_TEXT, SUGGESTION, SUGGESTION_LIST - rendered/matched as free text.
      return 'string';
  }
}

/**
 * Turns a Story Schema's custom fields into synthetic `EntityFieldMetadata`, so
 * `AdvancedSearchModal`/the per-service query loops treat them exactly like a native field -
 * `entityFieldMetadata` (the static registry) is never mutated, this is only concatenated onto it at
 * the point of use. `name` uses the `fieldId` (not the readable `key`) so it survives a rename.
 */
export function buildCustomAttributeFieldMetadata(
  fields: StorySchemaFieldSelect[],
): EntityFieldMetadata[] {
  return fields.map((field) => ({
    name: `${CUSTOM_FIELD_METADATA_PREFIX}${field.id}`,
    label: field.name,
    rawLabel: field.name,
    type: mapAttributeTypeToFieldType(field.type),
    isSearchable: true,
    isSuggestion: isSuggestionAttributeType(field.type),
    suggestionsSource: isSuggestionAttributeType(field.type)
      ? `${CUSTOM_FIELD_METADATA_PREFIX}${field.id}`
      : undefined,
    entityTargetType: field.targetEntityType,
  }));
}

export function extractCustomFieldId(metadataName: string): string | null {
  return metadataName.startsWith(CUSTOM_FIELD_METADATA_PREFIX)
    ? metadataName.slice(CUSTOM_FIELD_METADATA_PREFIX.length)
    : null;
}
