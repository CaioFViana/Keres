import type { StorySchemaEntityType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import type { EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useStorySchemaFields } from '../../../../hooks/useStorySchemaFields';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';
import { buildCustomAttributeFieldMetadata } from '../../../../utils/customAttributeFieldMetadata';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import StoryDateInput from '@/src/components/common/inputs/StoryDateInput/StoryDateInput';
import DatePickerInput from '@/src/components/common/inputs/DatePickerInput/DatePickerInput';
import SuggestionTextInput from '@/src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import TriStateToggleButton from '@/src/components/common/controls/TriStateToggleButton/TriStateToggleButton';
import EntityPickerInput from '@/src/components/common/inputs/EntityPickerInput/EntityPickerInput';

interface AdvancedSearchModalProps {
  entityName: string;
  isVisible: boolean;
  onClose: () => void;
  onSearch: (criteria: { [key: string]: any }) => void;
  storyId: string;
  initialCriteria?: { [key: string]: any };
  scopes?: AdvancedSearchScope[];
}

export interface AdvancedSearchScope {
  entityName: string;
  prefix: string;
  label: string;
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  entityName,
  isVisible,
  onClose,
  onSearch,
  storyId,
  initialCriteria = {},
  scopes,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [searchCriteria, setSearchCriteria] = useState<{ [key: string]: any }>(initialCriteria);

  const effectiveScopes = useMemo<AdvancedSearchScope[]>(
    () => scopes ?? [{ entityName: entityName as StorySchemaEntityType, prefix: '', label: '' }],
    [entityName, scopes],
  );

  useEffect(() => {
    setSearchCriteria(initialCriteria);
  }, [initialCriteria]);

  const handleInputChange = useCallback((fieldName: string, value: any) => {
    setSearchCriteria((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  const handleClear = useCallback(() => {
    setSearchCriteria({});
    onSearch({}); // Also trigger a search with empty criteria
    onClose();
  }, [onSearch, onClose]);

  const handleSubmit = useCallback(() => {
    onSearch(searchCriteria);
    onClose();
  }, [onSearch, searchCriteria, onClose]);

  const renderFieldInput = useCallback(
    (field: EntityFieldMetadata, styleOverrides?: any) => {
      const value = searchCriteria[field.name];
      // A Story Schema's custom fields already come with their display text ready (`rawLabel`, defined by
      // the user) - it is not a translation key, so it does not go through `t()`.
      const fieldLabel = field.rawLabel ?? t(field.label);
      const fieldLabelText = (
        <Text style={[styles.filledFieldLabel, { color: colors.textSecondary }]}>{fieldLabel}</Text>
      );

      if (field.isSuggestion) {
        return (
          <View
            key={field.name}
            style={[styles.inputContainer, styles.inputContainerSuggestion, styleOverrides]}
          >
            {fieldLabelText}
            <SuggestionTextInput
              placeholder={fieldLabel}
              value={value || ''}
              onChangeText={(text) => handleInputChange(field.name, text)}
              type={field.suggestionsSource as SuggestionType}
              storyId={storyId}
            />
          </View>
        );
      }

      switch (field.type) {
        case 'string':
        case 'id': // Treat ID fields as string for search input
          return (
            <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
              {fieldLabelText}
              <TextInput // Custom TextInput
                value={value || ''}
                onChangeText={(text) => handleInputChange(field.name, text)}
                placeholder={fieldLabel}
                placeholderTextColor={colors.textSecondary}
                style={{ width: '100%' }} // Explicitly override internal 80% width
              />
            </View>
          );
        case 'boolean':
          // For boolean, use the TriStateToggleButton
          return (
            <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
              <View style={styles.booleanRow}>
                <Text style={[styles.label, { color: colors.text, flex: 1, marginBottom: 0 }]}>
                  {fieldLabel}:
                </Text>
                <TriStateToggleButton
                  label={fieldLabel}
                  value={value}
                  onChange={(newValue) => handleInputChange(field.name, newValue)}
                  // style is not needed as size is fixed internally now
                />
              </View>
            </View>
          );
        case 'number':
          // For numbers, could offer range or exact match. For simplicity, single text input for now.
          return (
            <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
              {fieldLabelText}
              <TextInput // Custom TextInput
                value={value !== undefined && value !== null ? String(value) : ''}
                onChangeText={(text) =>
                  handleInputChange(field.name, text ? Number(text) : undefined)
                }
                keyboardType="numeric"
                placeholder={fieldLabel}
                placeholderTextColor={colors.textSecondary}
                style={{ width: '100%' }} // Explicitly override internal 80% width
              />
            </View>
          );
        case 'date':
          // No NATIVE field is `type: 'date'` in `entityFields.ts` - this case is only reached through a custom
          // attribute, so it uses the same picker as the form. The filter matches by substring (see
          // `attributeSearchPredicate`), so a complete date finds the exact day.
          return (
            <View
              key={field.name}
              style={[styles.inputContainer, styleOverrides, { marginBottom: 20 }]}
            >
              {fieldLabelText}
              <DatePickerInput
                value={value ? String(value) : null}
                onChange={(newValue) => handleInputChange(field.name, newValue ?? undefined)}
                placeholder={fieldLabel}
              />
            </View>
          );
        case 'story_date':
          // The same composed control as the form. The filter matches the stored day number
          // exactly, which is what picking a day in a calendar means.
          return (
            <View
              key={field.name}
              style={[styles.inputContainer, styleOverrides, { marginBottom: 20 }]}
            >
              {fieldLabelText}
              <StoryDateInput
                value={value ? String(value) : null}
                onChange={(newValue) => handleInputChange(field.name, newValue ?? undefined)}
              />
            </View>
          );
        case 'color':
          return (
            <View
              key={field.name}
              style={[styles.inputContainer, styleOverrides, { marginBottom: 20 }]}
            >
              {fieldLabelText}
              <ColorPickerInput
                currentColor={value || ''}
                onSelectColor={(newColor: string) => handleInputChange(field.name, newColor)}
                placeholder={fieldLabel}
              />
            </View>
          );
        case 'entity':
          if (!field.entityTargetType) return null;
          return (
            <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
              {fieldLabelText}
              <EntityPickerInput
                storyId={storyId}
                entityType={field.entityTargetType as StorySchemaEntityType}
                value={value ?? null}
                onChange={(newValue) => handleInputChange(field.name, newValue)}
                placeholder={fieldLabel}
              />
            </View>
          );
        default:
          return null;
      }
    },
    [searchCriteria, handleInputChange, colors, t, storyId],
  );

  return (
    <ResponsiveModal
      visible={isVisible}
      onClose={onClose}
      contentStyle={[
        styles.modalContent,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      maxHeight="86%"
    >
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          {t('advanced_search_title')}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {effectiveScopes.map((scope) => (
          <AdvancedSearchScopeFields
            key={`${scope.entityName}:${scope.prefix}`}
            scope={scope}
            storyId={storyId}
            showLabel={effectiveScopes.length > 1}
            renderFieldInput={renderFieldInput}
          />
        ))}
      </ScrollView>
      <View style={styles.modalFooter}>
        <View style={styles.buttonWrapper}>
          <Button onPress={handleClear} style={{ backgroundColor: colors.textSecondary }}>
            {t('common_clear')}
          </Button>
        </View>
        <View style={styles.buttonWrapper}>
          <Button onPress={handleSubmit} style={{ backgroundColor: colors.primary }}>
            {t('common_search')}
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

interface AdvancedSearchScopeFieldsProps {
  scope: AdvancedSearchScope;
  storyId: string;
  showLabel: boolean;
  renderFieldInput: (field: EntityFieldMetadata, styleOverrides?: any) => React.ReactNode;
}

const AdvancedSearchScopeFields: React.FC<AdvancedSearchScopeFieldsProps> = ({
  scope,
  storyId,
  showLabel,
  renderFieldInput,
}) => {
  const { colors } = useTheme();
  const customFields = useStorySchemaFields(storyId, scope.entityName as StorySchemaEntityType);
  const fields = useMemo(
    () => [
      ...(entityFieldMetadata[scope.entityName]?.filter((field) => field.isSearchable) ?? []),
      ...buildCustomAttributeFieldMetadata(customFields),
    ],
    [customFields, scope.entityName],
  );

  return (
    <View>
      {showLabel && <Text style={[styles.scopeTitle, { color: colors.text }]}>{scope.label}</Text>}
      {fields.map((field) =>
        renderFieldInput({
          ...field,
          name: scope.prefix ? `${scope.prefix}:${field.name}` : field.name,
        }),
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    // ResponsiveModal normally clips to preserve rounded media/modal surfaces.
    // Advanced-search controls draw their focus treatment at the edge, so this
    // particular form must let that treatment extend into its own padding.
    overflow: 'visible',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flexGrow: 1,
    marginBottom: 20,
  },
  // Keeps an input's themed focus border inside the scrollable clipping area.
  scrollContent: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  inputContainer: {
    marginBottom: 0,
    // The native/web focus treatment can extend a pixel beyond the control.
    // Keep that room at the immediate parent, not only at ScrollView level.
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  inputContainerSuggestion: {
    marginBottom: 20,
  },
  filledFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  scopeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 8,
  },
  booleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    // This style is now only for boolean fields
    fontSize: 14,
    marginBottom: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: '3%',
  },
  buttonWrapper: {
    width: '47%',
  },
});

export default AdvancedSearchModal;
