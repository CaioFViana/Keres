import { AttributeType } from '@keres/shared';
import React from 'react';
import { Switch } from 'react-native';
import { customAttributeSuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';

interface AttributeValueInputProps {
  type: AttributeType | string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  storyId?: string;
  /** Só usado quando `type === SUGGESTION`. Sem isto (campo recém-criado, ainda sem id salvo),
   *  cai pra texto simples em vez de tentar abrir sugestões de um campo que não existe. */
  suggestionFieldId?: string;
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
        <Switch
          value={value === 'true'}
          onValueChange={(newValue) => onChange(newValue ? 'true' : 'false')}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value === 'true' ? colors.onPrimary : colors.textSecondary}
          style={{ alignSelf: 'flex-start', transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
        />
      );

    case AttributeType.DATE:
      // Nenhum date picker existe em nenhum lugar do app hoje (nem o próprio AdvancedSearchModal
      // tem um pra seu filtro de data) - texto livre com um placeholder de formato é o único
      // precedente existente, não uma escolha nova.
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || 'YYYY-MM-DD'}
          style={[commonInputStyles.input, style]}
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
