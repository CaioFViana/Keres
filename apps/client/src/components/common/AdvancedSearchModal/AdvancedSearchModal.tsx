import { StorySchemaEntityType } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { entityFieldMetadata, EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStorySchemaFields } from '../../../hooks/useStorySchemaFields';
import { SuggestionType } from '../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../theme';
import { buildCustomAttributeFieldMetadata } from '../../../utils/customAttributeFieldMetadata';
import Button from '../Button/Button';
import ColorPickerInput from '../ColorPickerInput/ColorPickerInput';
import SuggestionTextInput from '../SuggestionTextInput/SuggestionTextInput';
import TextInput from '../TextInput/TextInput';
import TriStateToggleButton from '../TriStateToggleButton/TriStateToggleButton';

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

  // Get metadata for the specified entity
  const nativeFieldsMetadata = useMemo(() => {
    return entityFieldMetadata[entityName]?.filter(field => field.isSearchable) || [];
  }, [entityName]);

  // Campos customizados de Story Schema para este tipo de entidade - vazio (sem custo extra
  // além da própria query, que só encontra 0 linhas) para tipos de entidade fora do escopo
  // suportado, sem precisar de um type guard aqui.
  const customFields = useStorySchemaFields(storyId, entityName as StorySchemaEntityType);
  const customFieldsMetadata = useMemo(() => buildCustomAttributeFieldMetadata(customFields), [customFields]);

  const fieldsMetadata = useMemo(
    () => [...nativeFieldsMetadata, ...customFieldsMetadata],
    [nativeFieldsMetadata, customFieldsMetadata]
  );


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
    // Campos customizados de Story Schema já vêm com o texto de exibição pronto (`rawLabel`,
    // definido pelo usuário) - não é uma chave de tradução, então não passa por `t()`.
    const fieldLabel = field.rawLabel ?? t(field.label);

    if (field.isSuggestion) {
      return (
        <View key={field.name} style={[styles.inputContainer, styles.inputContainerSuggestion, styleOverrides]}>
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
              <Text style={[styles.label, { color: colors.text, flex: 1, marginBottom: 0 }]}>{fieldLabel}:</Text>
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
            <TextInput // Custom TextInput
              value={value !== undefined && value !== null ? String(value) : ''}
              onChangeText={(text) => handleInputChange(field.name, text ? Number(text) : undefined)}
              keyboardType="numeric"
              placeholder={fieldLabel}
              placeholderTextColor={colors.textSecondary}
              style={{ width: '100%' }} // Explicitly override internal 80% width
            />
          </View>
        );
      case 'date':
        // For dates, typically date pickers or range inputs. For simplicity, text input for now.
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides]}>
            <TextInput // Custom TextInput
              value={value ? String(value) : ''} // Needs date formatting
              onChangeText={(text) => handleInputChange(field.name, text)} // Needs date parsing
              placeholder={fieldLabel}
              placeholderTextColor={colors.textSecondary}
              style={{ width: '100%' }} // Explicitly override internal 80% width
            />
          </View>
        );
      case 'color':
        return (
          <View key={field.name} style={[styles.inputContainer, styleOverrides, {marginBottom: 20}]}>
            <ColorPickerInput
              currentColor={value || ''}
              onSelectColor={(newColor: string) => handleInputChange(field.name, newColor)}
              placeholder={fieldLabel}
            />
          </View>
        );
      default:
        return null;
    }
  }, [searchCriteria, handleInputChange, colors, t, storyId]);

  return (
    <Modal
      animationType="fade"
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
            <View style={styles.buttonWrapper}>
              <Button onPress={handleClear} style={{ backgroundColor: colors.textSecondary }}>{t('common_clear')}</Button>
            </View>
            <View style={styles.buttonWrapper}>
              <Button onPress={handleSubmit} style={{ backgroundColor: colors.primary }}>{t('common_search')}</Button>
            </View>
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
  inputContainerSuggestion: {
    marginBottom: 20
  },
  booleanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: { // This style is now only for boolean fields
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