import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import StoryDateInput from '@/src/components/common/inputs/StoryDateInput/StoryDateInput';
import SuggestionListInput from '@/src/components/common/inputs/SuggestionListInput/SuggestionListInput';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useEntityPickerOptions } from '@/src/hooks/useEntityPickerOptions';
import type { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import {
  AttributeType,
  decodeAttributeValue,
  encodeAttributeValue,
  getEntityAppearance,
} from '@keres/shared';
import React, { useMemo } from 'react';
import { CUSTOM_FIELD_METADATA_PREFIX } from '../../../../utils/customAttributeFieldMetadata';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';

interface AttributeValueInputProps {
  type: AttributeType | string;
  value: string;
  onChange: (value: string | null) => void;
  placeholder?: string;
  storyId?: string;
  /**
   * Only used when `type === SUGGESTION`. Without it (a freshly created field, with no saved id yet), it
   * falls back to plain text instead of trying to open suggestions for a field that does not exist.
   */
  suggestionFieldId?: string;
  /** Declared target of an ENTITY field. */
  targetEntityType?: StorySchemaEntityType | null;
  style?: any;
}

/**
 * A single dispatcher per `AttributeType`, used both by the real custom fields (`CustomAttributeFields`,
 * in Forms) and by the "Default Value" field of the schema management screen itself
 * (`StorySchemaFieldFormScreen`) - the same per-type rendering logic instead of two slightly different
 * implementations.
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
  const { options: entityOptions, loading: entityOptionsLoading } = useEntityPickerOptions(
    storyId,
    targetEntityType,
  );
  const entityPillOptions = useMemo(
    () =>
      targetEntityType
        ? entityOptions.map((option) => ({
            label: option.name || '—',
            value: option.id,
            color: getEntityAppearance(targetEntityType).color,
            icon: getEntityAppearance(targetEntityType).icon as keyof typeof Ionicons.glyphMap,
          }))
        : [],
    [entityOptions, targetEntityType],
  );

  switch (type) {
    case AttributeType.LONG_TEXT:
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          multiline
          style={[commonInputStyles.multiline, style]}
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

    case AttributeType.STORY_DATE:
      return <StoryDateInput value={value || null} onChange={onChange} />;

    case AttributeType.SUGGESTION:
      if (storyId && suggestionFieldId) {
        return (
          <SuggestionTextInput
            value={value}
            onChangeText={onChange}
            type={`${CUSTOM_FIELD_METADATA_PREFIX}${suggestionFieldId}`}
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

    case AttributeType.SUGGESTION_LIST: {
      const decoded = decodeAttributeValue(AttributeType.SUGGESTION_LIST, value);
      const items = Array.isArray(decoded) ? decoded : [];
      return (
        <SuggestionListInput
          values={items}
          onChange={(next) => onChange(encodeAttributeValue(AttributeType.SUGGESTION_LIST, next))}
          type={suggestionFieldId ? `${CUSTOM_FIELD_METADATA_PREFIX}${suggestionFieldId}` : ''}
          storyId={storyId ?? ''}
          placeholder={placeholder}
          style={style}
        />
      );
    }

    case AttributeType.ENTITY:
      if (storyId && targetEntityType) {
        return (
          <MultiSelectPill
            options={entityPillOptions}
            selectedValues={value ? [value] : []}
            onSelectionChange={(selected) => onChange(selected[0] ?? null)}
            singleSelect
            placeholder={placeholder}
            noOptionsText={entityOptionsLoading ? '…' : undefined}
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
