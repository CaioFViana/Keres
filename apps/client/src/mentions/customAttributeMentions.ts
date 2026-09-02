import {
  AttributeType,
  explodeAttributeUsageValue,
  type StorySchemaEntityType,
} from '@keres/shared';

interface MentionableCustomField {
  id: string;
  entityType: StorySchemaEntityType;
  type: AttributeType;
  defaultValue: string | null;
}

interface MentionableCustomValue {
  entityType: StorySchemaEntityType;
  entityId: string;
  fieldId: string;
  value: string | null;
}

const TEXTUAL_ATTRIBUTE_TYPES = new Set<AttributeType>([
  AttributeType.TEXT,
  AttributeType.LONG_TEXT,
  AttributeType.SUGGESTION,
  AttributeType.SUGGESTION_LIST,
]);

/**
 * Custom values use the same display as their detail fields: a missing value falls back to the
 * field default. Structured values (numbers, dates, booleans and entity references) are either
 * not prose or already have their own representation, so they must not manufacture backlinks.
 */
export function customAttributeMentionFields(
  entityType: string,
  entityId: string,
  fields: readonly MentionableCustomField[],
  values: readonly MentionableCustomValue[],
): Record<string, string> {
  const valuesByFieldId = new Map(
    values
      .filter((value) => value.entityType === entityType && value.entityId === entityId)
      .map((value) => [value.fieldId, value.value]),
  );

  return Object.fromEntries(
    fields.flatMap((field) => {
      if (field.entityType !== entityType || !TEXTUAL_ATTRIBUTE_TYPES.has(field.type)) return [];
      const stored = valuesByFieldId.get(field.id) ?? field.defaultValue;
      if (!stored) return [];
      const text = explodeAttributeUsageValue(field.type, stored).join('\n');
      return text ? [[`custom:${field.id}`, text]] : [];
    }),
  );
}
