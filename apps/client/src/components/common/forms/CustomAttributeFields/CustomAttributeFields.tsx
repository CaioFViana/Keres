import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StorySchemaEntityType } from '@keres/shared';
import { AttributeType, decodeAttributeValue } from '@keres/shared';
import type { StorySchemaFieldSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import AttributeValueInput from '@/src/components/common/forms/CustomAttributeFields/AttributeValueInput';

export type CustomAttributeValues = Record<string, string | null>;

/**
 * Each field's default values, to pre-fill the local state of a NEW entity (it never
 * overwrites an existing entity being edited - the form only calls this once, on creation).
 */
export function getDefaultCustomAttributeValues(
  fields: StorySchemaFieldSelect[],
): CustomAttributeValues {
  const defaults: CustomAttributeValues = {};
  for (const field of fields) {
    defaults[field.id] = field.defaultValue ?? null;
  }
  return defaults;
}

/**
 * The error message of the first empty required field, or `null` if they are all filled in -
 * the same shape of simple validation already used inline in the forms (`if (!name.trim())`).
 */
export function validateRequiredCustomAttributes(
  fields: StorySchemaFieldSelect[],
  values: CustomAttributeValues,
): string | null {
  for (const field of fields) {
    if (!field.isRequired) continue;
    const value = values[field.id];
    if (field.type === AttributeType.SUGGESTION_LIST) {
      const decoded = decodeAttributeValue(AttributeType.SUGGESTION_LIST, value);
      if (!Array.isArray(decoded) || decoded.length === 0) {
        return field.name;
      }
      continue;
    }
    if (value === null || value === undefined || value.trim() === '') {
      return field.name;
    }
  }
  return null;
}

interface CustomAttributeFieldsProps {
  storyId: string;
  fields: StorySchemaFieldSelect[];
  values: CustomAttributeValues;
  onChange: (fieldId: string, value: string | null) => void;
}

/**
 * Renders a Story Schema's custom attributes as form fields, in the same
 * position on every Form screen: after the native fields, before Tags/relations. A single
 * component reused by all 7 entity types instead of logic duplicated per screen.
 */
const CustomAttributeFields: React.FC<CustomAttributeFieldsProps> = ({
  storyId,
  fields,
  values,
  onChange,
}) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 5,
      color: colors.text,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 5,
    },
  });

  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      {fields.map((field) => (
        <View key={field.id}>
          <Text style={styles.label}>
            {field.name}
            {field.isRequired ? ' *' : ''}
          </Text>
          {field.description && <Text style={styles.description}>{field.description}</Text>}
          <AttributeValueInput
            type={field.type}
            value={values[field.id] ?? ''}
            onChange={(value) => onChange(field.id, value)}
            placeholder={field.name}
            storyId={storyId}
            suggestionFieldId={field.id}
            targetEntityType={field.targetEntityType as StorySchemaEntityType | null}
          />
        </View>
      ))}
    </>
  );
};

export default CustomAttributeFields;
