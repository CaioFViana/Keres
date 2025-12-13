import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../db';
import { createSuggestionService, SuggestionServiceInterface, SuggestionType } from '../../../services/SuggestionService';
import { useTheme } from '../../../theme';
import { getCommonInputStyles } from '../../../theme/commonStyles';
import Button from '../Button/Button'; // Reusing existing Button
import TextInput from '../TextInput/TextInput'; // Reusing existing TextInput

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
  const drizzleDb = useDrizzle();
  const commonInputStyles = getCommonInputStyles(colors);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<[string, number][]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Initialize SuggestionService
  const suggestionService: SuggestionServiceInterface | null = useMemo(() => {
    if (drizzleDb) {
      return createSuggestionService(drizzleDb);
    }
    return null;
  }, [drizzleDb]);

  const fetchSuggestions = useCallback(async () => {
    if (!suggestionService || !type || !storyId) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const fetched = await suggestionService.getSuggestions(type, storyId); // Use storyId prop
      setSuggestions(fetched);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [suggestionService, type, storyId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions, storyId]);

  const handleToggleSuggestions = () => {
    setShowSuggestions(prev => !prev);
    if (!showSuggestions) { // If opening, fetch suggestions
      fetchSuggestions();
    }
  };

  const handleSelectSuggestion = (suggestion: [string, number]) => {
    onChangeText(suggestion[0]); // Extract the string value
    setShowSuggestions(false);
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 10
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      minHeight: 50
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
      borderRadius: 5,
      marginLeft: -1, // Overlap border
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderRadius: 10,
      width: Dimensions.get('window').width * 0.8,
      maxHeight: Dimensions.get('window').height * 0.7,
      padding: 10,
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
    }
  });

  return (
    <View style={[styles.container, style, commonInputStyles.input, commonInputStyles.customComponentInput]}>
      <View style={styles.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          style={[commonInputStyles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', marginBottom: 0 }]}
          {...rest}
        />
        <TouchableOpacity style={styles.suggestionButton} onPress={handleToggleSuggestions} disabled={loadingSuggestions}>
          {loadingSuggestions ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="bulb-outline" size={24} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showSuggestions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSuggestions(false)}>
          <View style={styles.modalContent}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item[0]}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => handleSelectSuggestion(item)}>
                  <Text style={styles.suggestionText}>{item[0]}</Text>
                  {item[1] > 0 && <Text style={styles.suggestionCount}>{item[1]}</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.noSuggestionsText}>{t('no_suggestions_available')}</Text>}
            />
            <Button onPress={() => setShowSuggestions(false)} style={styles.closeButton}>
              {t('close')}
            </Button>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default SuggestionTextInput;