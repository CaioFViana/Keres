import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput'; // Reusing existing TextInput
import SuggestionCatalogModal from '../SuggestionCatalogModal/SuggestionCatalogModal';
import { useSuggestionCatalog } from '../SuggestionCatalogModal/useSuggestionCatalog';

interface SuggestionTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  type: SuggestionType; // Type for suggestions
  placeholder?: string;
  style?: any;
  storyId: string;
}

const SuggestionTextInput: React.FC<SuggestionTextInputProps> = ({
  value,
  onChangeText,
  type,
  placeholder,
  style,
  storyId,
  ...rest
}) => {
  const { colors } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);
  const {
    suggestions,
    loading,
    reload,
    showSuggestions,
    searchQuery,
    setSearchQuery,
    closeSuggestions,
    toggleSuggestions,
  } = useSuggestionCatalog(storyId, type);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSelectSuggestion = (suggestion: [string, number]) => {
    onChangeText(suggestion[0]);
    closeSuggestions();
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 5,
      backgroundColor: colors.surface,
      minHeight: 50,
      overflow: 'hidden',
    },
    inputField: {
      flex: 1,
      paddingHorizontal: 10,
      color: colors.text,
    },
    suggestionButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      marginLeft: -1, // Overlap border
      alignSelf: 'stretch',
      justifyContent: 'center',
      alignItems: 'center',
    },
    suggestionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      color: colors.text,
      fontSize: 16,
    },
    suggestionCount: {
      color: colors.textSecondary,
      fontSize: 16,
    },
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          style={[
            commonInputStyles.input,
            { flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginBottom: 0 },
          ]}
          suppressInteractionBorder
          {...rest}
        />
        <TouchableOpacity
          style={styles.suggestionButton}
          onPress={toggleSuggestions}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="bulb-outline" size={24} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <SuggestionCatalogModal
        visible={showSuggestions}
        loading={loading}
        suggestions={suggestions}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClose={closeSuggestions}
        renderOption={(item) => (
          <TouchableOpacity
            style={styles.suggestionItem}
            onPress={() => handleSelectSuggestion(item)}
          >
            <Text style={styles.suggestionText}>{item[0]}</Text>
            {item[1] > 0 && <Text style={styles.suggestionCount}>{item[1]}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default SuggestionTextInput;
