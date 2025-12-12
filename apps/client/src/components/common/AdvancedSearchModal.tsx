// apps/client/src/components/common/AdvancedSearchModal.tsx
import { Ionicons } from '@expo/vector-icons';
import { entityFieldMetadata, EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Removed TextInput from RN
import { SuggestionType } from '../../services/SuggestionService'; // Added for casting
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles'; // Added import
import SuggestionTextInput from './SuggestionTextInput/SuggestionTextInput'; // Added
import TextInput from './TextInput/TextInput'; // Added custom TextInput

interface AdvancedSearchModalProps {
  entityName: string;
  isVisible: boolean;
  onClose: () => void;
  onSearch: (criteria: { [key: string]: any }) => void;
  storyId: string;
  initialCriteria?: { [key: string]: any };
}

const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  entityName,
  isVisible,
  onClose,
  onSearch,
  storyId,
  initialCriteria = {},
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [searchCriteria, setSearchCriteria] = useState<{ [key: string]: any }>(initialCriteria);

  const commonInputStyles = getCommonInputStyles(colors); // Added commonInputStyles

  // Get metadata for the specified entity
  const fieldsMetadata = useMemo(() => {
    return entityFieldMetadata[entityName]?.filter(field => field.isSearchable) || [];
  }, [entityName]);


  useEffect(() => {
    setSearchCriteria(initialCriteria);
  }, [initialCriteria]);

  const handleInputChange = useCallback((fieldName: string, value: any) => {
    setSearchCriteria(prev => ({
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

  const renderFieldInput = useCallback((field: EntityFieldMetadata, styleOverrides?: any) => {
    const value = searchCriteria[field.name];

    if (field.isSuggestion) {
      return (
        <View key={field.name} style={[styles.inputContainer]}>
          <SuggestionTextInput
            placeholder={t(field.label)}
            value={value || ''}
            onChangeText={(text) => handleInputChange(field.name, text)}
            type={field.suggestionsSource as SuggestionType}
            storyId={storyId}
            style={[commonInputStyles.input, styles.suggestionInputContainer]}
          />
        </View>
      );
    }

    switch (field.type) {
      case 'string':
      case 'id': // Treat ID fields as string for search input
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
            <TextInput
              value={value || ''}
              onChangeText={(text) => handleInputChange(field.name, text)}
              placeholder={t(field.label)}
              placeholderTextColor={colors.textSecondary}
              style={{ width: '100%' }}
            />
          </View>
        );
      case 'boolean':
        // For boolean, offer a selection: 'true', 'false', or 'any'
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
            <Text style={[styles.label, { color: colors.text }]}>{t(field.label)}:</Text>
            <View style={styles.booleanOptionsContainer}>
              <TouchableOpacity
                style={[styles.booleanOption, value === true && { backgroundColor: colors.primary }]}
                onPress={() => handleInputChange(field.name, true)}
              >
                <Text style={[styles.booleanOptionText, value === true && { color: colors.onPrimary }]}>{t('common_yes')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.booleanOption, value === false && { backgroundColor: colors.primary }]}
                onPress={() => handleInputChange(field.name, false)}
              >
                <Text style={[styles.booleanOptionText, value === false && { color: colors.onPrimary }]}>{t('common_no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.booleanOption, value === undefined && { backgroundColor: colors.primary }]}
                onPress={() => handleInputChange(field.name, undefined)}
              >
                <Text style={[styles.booleanOptionText, value === undefined && { color: colors.onPrimary }]}>{t('common_any')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'number':
        // For numbers, could offer range or exact match. For simplicity, single text input for now.
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
            <TextInput
              value={value !== undefined && value !== null ? String(value) : ''}
              onChangeText={(text) => handleInputChange(field.name, text ? Number(text) : undefined)}
              keyboardType="numeric"
              placeholder={t(field.label)}
              placeholderTextColor={colors.textSecondary}
              style={{ width: '100%' }} // Override custom TextInput's internal 80% width
            />
          </View>
        );
      case 'date':
        // For dates, typically date pickers or range inputs. For simplicity, text input for now.
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
            <TextInput
              value={value ? String(value) : ''} // Needs date formatting
              onChangeText={(text) => handleInputChange(field.name, text)} // Needs date parsing
              placeholder={t(field.label)}
              placeholderTextColor={colors.textSecondary}
              style={{ width: '100%' }}
            />
          </View>
        );
      default:
        return null;
    }
  }, [searchCriteria, handleInputChange, colors, t, storyId, commonInputStyles.input]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('advanced_search_title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scrollView}>
            {fieldsMetadata.map(renderFieldInput)}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button title={t('common_clear')} onPress={handleClear} color={colors.textSecondary} />
            <Button title={t('common_search')} onPress={handleSubmit} color={colors.primary} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
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
  inputContainer: {
    marginBottom: 0,
  },
  suggestionInputContainer: {
    marginBottom: 20,
  },
  label: { // This style is now only for boolean fields
    fontSize: 14,
    marginBottom: 2,
  },
  booleanOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  booleanOption: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent', // Will be set by theme colors
  },
  booleanOptionText: {
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});

export default AdvancedSearchModal;