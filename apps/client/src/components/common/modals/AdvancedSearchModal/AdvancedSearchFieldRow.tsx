import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance, type StorySchemaEntityType } from '@keres/shared';
import type { EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TriStateToggleButton from '@/src/components/common/controls/TriStateToggleButton/TriStateToggleButton';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import StoryDateInput from '@/src/components/common/inputs/StoryDateInput/StoryDateInput';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useEntityPickerOptions } from '@/src/hooks/useEntityPickerOptions';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';

/** Advanced-search fields have a dynamic target type, but selection remains MultiSelectPill. */
const AdvancedEntityPicker: React.FC<{
  storyId: string;
  entityType: StorySchemaEntityType;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
}> = ({ storyId, entityType, value, onChange, placeholder }) => {
  const { t } = useTranslation();
  const { options, loading } = useEntityPickerOptions(storyId, entityType);
  return (
    <MultiSelectPill
      options={options.map((option) => ({
        label: option.name || t('unnamed'),
        value: option.id,
        color: getEntityAppearance(entityType).color,
        icon: getEntityAppearance(entityType).icon as keyof typeof Ionicons.glyphMap,
      }))}
      selectedValues={value ? [value] : []}
      onSelectionChange={(selected) => onChange(selected[0] ?? null)}
      singleSelect
      placeholder={placeholder}
      noOptionsText={loading ? t('loading') : t('attribute_entity_none')}
    />
  );
};

interface AdvancedSearchFieldRowProps {
  field: EntityFieldMetadata;
  /** The criteria key for this field in its scope (`scene:name`, `custom:<id>`, `name`). */
  name: string;
  label: string;
  value: any;
  storyId: string;
  onChange: (value: any) => void;
  onRemove: () => void;
  /** Enter in a text field applies the filters. */
  onSubmit: () => void;
}

/** A field's input carries no label of its own (the row has it), except where the field is a yes/no. */
const FieldControl: React.FC<Omit<AdvancedSearchFieldRowProps, 'onRemove'>> = ({
  field,
  name,
  label,
  value,
  storyId,
  onChange,
  onSubmit,
}) => {
  const { t } = useTranslation();
  if (field.isSuggestion) {
    return (
      <SuggestionTextInput
        placeholder={label}
        value={value || ''}
        onChangeText={onChange}
        type={field.suggestionsSource as SuggestionType}
        storyId={storyId}
      />
    );
  }

  switch (field.type) {
    case 'string':
    case 'id': // Treat ID fields as string for search input
      return (
        <TextInput
          testID={`advanced-field-${name}`}
          value={value || ''}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          placeholder={t('advanced_search_contains')}
          style={styles.fullWidth}
        />
      );
    case 'number':
      return (
        <TextInput
          testID={`advanced-field-${name}`}
          value={value !== undefined && value !== null ? String(value) : ''}
          onChangeText={(text) => {
            // A number field takes letters on the web; those match nothing, so they are not a filter.
            const parsed = Number(text);
            onChange(text && !Number.isNaN(parsed) ? parsed : undefined);
          }}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          keyboardType="numeric"
          placeholder={t('advanced_search_equals')}
          style={styles.fullWidth}
        />
      );
    case 'date':
      // No NATIVE field is `type: 'date'` in `entityFields.ts` - this case is only reached through a custom
      // attribute, so it uses the same picker as the form. The filter matches by substring (see
      // `attributeSearchPredicate`), so a complete date finds the exact day.
      return (
        <DatePickerInput
          value={value ? String(value) : null}
          onChange={(newValue) => onChange(newValue ?? undefined)}
          placeholder={label}
        />
      );
    case 'story_date':
      // The same composed control as the form. The filter matches the stored day number
      // exactly, which is what picking a day in a calendar means.
      return (
        <StoryDateInput
          value={value ? String(value) : null}
          onChange={(newValue) => onChange(newValue ?? undefined)}
        />
      );
    case 'color':
      return (
        <ColorPickerInput
          currentColor={value || ''}
          onSelectColor={(newColor: string) => onChange(newColor)}
          placeholder={label}
        />
      );
    case 'entity':
      if (!field.entityTargetType) return null;
      return (
        <AdvancedEntityPicker
          storyId={storyId}
          entityType={field.entityTargetType as StorySchemaEntityType}
          value={value ?? null}
          onChange={onChange}
          placeholder={label}
        />
      );
    case 'boolean':
      return <TriStateToggleButton label={label} value={value} onChange={onChange} />;
    default:
      return null;
  }
};

/** Whether the field has an input at all: an entity field with no target type has none. */
export const isRenderableField = (field: EntityFieldMetadata): boolean => {
  if (field.isSuggestion) return true;
  if (field.type === 'entity') return !!field.entityTargetType;
  return ['string', 'id', 'number', 'date', 'story_date', 'color', 'boolean'].includes(field.type);
};

const AdvancedSearchFieldRow: React.FC<AdvancedSearchFieldRowProps> = (props) => {
  const { field, label, onRemove, name } = props;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isBoolean = !field.isSuggestion && field.type === 'boolean';

  return (
    <View style={styles.row} testID={`advanced-row-${name}`}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {isBoolean ? <FieldControl {...props} /> : null}
        <TouchableOpacity
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('list_remove_filter', { filter: label })}
          testID={`advanced-remove-${name}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {isBoolean ? null : <FieldControl {...props} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: 14,
    // The native/web focus treatment can extend a pixel beyond the control.
    // Keep that room at the immediate parent, not only at ScrollView level.
    paddingHorizontal: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
});

export default AdvancedSearchFieldRow;
