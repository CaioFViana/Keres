import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { useSuggestions } from '../../../../hooks/useSuggestions';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import Button from '@/src/components/common/controls/Button/Button'; // Reusing existing Button
import TextInput from '@/src/components/common/inputs/TextInput/TextInput'; // Reusing existing TextInput
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

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
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const commonInputStyles = getCommonInputStyles(colors);
  const { suggestions, loading: loadingSuggestions, reload } = useSuggestions(storyId, type);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return suggestions;
    return suggestions.filter(([suggestion]) => suggestion.toLocaleLowerCase().includes(query));
  }, [searchQuery, suggestions]);

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSearchQuery('');
  }, []);

  const handleToggleSuggestions = () => {
    if (showSuggestions) {
      closeSuggestions();
    } else {
      setShowSuggestions(true);
      void reload();
    }
  };

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
    modalContent: {
      padding: 10,
    },
    searchInput: {
      width: '100%',
      marginBottom: 10,
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
    noSuggestionsText: {
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    closeButton: {
      marginTop: 20,
      alignSelf: 'flex-end',
    },
    suggestionsList: {
      maxHeight: Math.min(screenHeight * 0.56, 520),
    },
    loadingContainer: {
      minHeight: 90,
      alignItems: 'center',
      justifyContent: 'center',
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
          onPress={handleToggleSuggestions}
          disabled={loadingSuggestions}
        >
          {loadingSuggestions ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="bulb-outline" size={24} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <ResponsiveModal
        visible={showSuggestions}
        onClose={closeSuggestions}
        contentStyle={styles.modalContent}
        maxHeight={Math.min(screenHeight * 0.78, 680)}
      >
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('search')}
          style={styles.searchInput}
        />
        {loadingSuggestions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.suggestionsList}
            data={filteredSuggestions}
            keyExtractor={(item) => item[0]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text style={styles.suggestionText}>{item[0]}</Text>
                {item[1] > 0 && <Text style={styles.suggestionCount}>{item[1]}</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noSuggestionsText}>{t('no_suggestions_available')}</Text>
            }
          />
        )}
        <Button onPress={closeSuggestions} style={styles.closeButton}>
          {t('close')}
        </Button>
      </ResponsiveModal>
    </View>
  );
};

export default SuggestionTextInput;
