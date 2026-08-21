import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AttributeType, decodeAttributeValue, StorySchemaEntityType } from '@keres/shared';
import { StorySchemaFieldSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import AttributeValueInput from '@/src/components/common/forms/CustomAttributeFields/AttributeValueInput';

export type CustomAttributeValues = Record<string, string | null>;

/** Valores padrão de cada campo, pra pré-preencher o estado local de uma entidade NOVA (nunca
 *  sobrescreve uma entidade existente sendo editada - o form só chama isto uma vez, ao criar). */
export function getDefaultCustomAttributeValues(
  fields: StorySchemaFieldSelect[],
): CustomAttributeValues {
  const defaults: CustomAttributeValues = {};
  for (const field of fields) {
    defaults[field.id] = field.defaultValue ?? null;
  }
  return defaults;
}

/** Mensagem de erro do primeiro campo obrigatório vazio, ou `null` se todos estão preenchidos -
 *  mesma forma de validação simples já usada inline nos forms (`if (!name.trim())`). */
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
 * Renderiza os atributos customizados de um Story Schema como campos de formulário, na mesma
 * posição em todo Form screen: depois dos campos nativos, antes de Tags/relações. Um único
 * componente reaproveitado por todos os 7 tipos de entidade em vez de lógica duplicada por tela.
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
