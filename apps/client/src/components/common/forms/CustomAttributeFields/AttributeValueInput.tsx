import { AttributeType, StorySchemaEntityType } from '@keres/shared';
import React from 'react';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { customAttributeSuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import EntityPickerInput from '@/src/components/common/inputs/EntityPickerInput/EntityPickerInput';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';

interface AttributeValueInputProps {
  type: AttributeType | string;
  value: string;
  onChange: (value: string | null) => void;
  placeholder?: string;
  storyId?: string;
  /** Só usado quando `type === SUGGESTION`. Sem isto (campo recém-criado, ainda sem id salvo),
   *  cai pra texto simples em vez de tentar abrir sugestões de um campo que não existe. */
  suggestionFieldId?: string;
  /** Declared target of an ENTITY field. */
  targetEntityType?: StorySchemaEntityType | null;
  style?: any;
}

/**
 * Dispatcher único por `AttributeType`, usado tanto pelos campos customizados de verdade
 * (`CustomAttributeFields`, em Forms) quanto pelo campo "Valor Padrão" da própria tela de
 * gerenciamento de schema (`StorySchemaFieldFormScreen`) - mesma lógica de renderização por
 * tipo em vez de duas implementações levemente diferentes.
 */
const AttributeValueInput: React.FC<AttributeValueInputProps> = ({
  type,
  value,
  onChange,
  placeholder,
  storyId,
  suggestionFieldId,
  targetEntityType,
  style,
}) => {
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);

  switch (type) {
    case AttributeType.LONG_TEXT:
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          multiline
          style={[commonInputStyles.input, { minHeight: 4 * 20, textAlignVertical: 'top' }, style]}
        />
      );

    case AttributeType.NUMBER:
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          keyboardType="numeric"
          style={[commonInputStyles.input, style]}
        />
      );

    case AttributeType.BOOLEAN:
      return (
        <ThemedSwitch
          value={value === 'true'}
          onValueChange={(newValue) => onChange(newValue ? 'true' : 'false')}
          style={{ alignSelf: 'flex-start', transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      );

    case AttributeType.DATE:
      return (
        <DatePickerInput
          value={value || null}
          onChange={onChange}
          placeholder={placeholder}
          style={style}
        />
      );

    case AttributeType.SUGGESTION:
      if (storyId && suggestionFieldId) {
        return (
          <SuggestionTextInput
            value={value}
            onChangeText={onChange}
            type={customAttributeSuggestionType(suggestionFieldId)}
            storyId={storyId}
            placeholder={placeholder}
            style={style}
          />
        );
      }
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          style={[commonInputStyles.input, style]}
        />
      );

    case AttributeType.ENTITY:
      if (storyId && targetEntityType) {
        return (
          <EntityPickerInput
            storyId={storyId}
            entityType={targetEntityType}
            value={value || null}
            onChange={onChange}
            placeholder={placeholder}
          />
        );
      }
      return (
        <TextInput
          value={value}
          placeholder={placeholder}
          editable={false}
          style={[commonInputStyles.input, style]}
        />
      );

    case AttributeType.TEXT:
    default:
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          style={[commonInputStyles.input, style]}
        />
      );
  }
};

export default AttributeValueInput;
