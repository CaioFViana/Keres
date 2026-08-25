import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useDrizzle } from '../../../../db';
import type {
  SuggestionServiceInterface,
  SuggestionType,
} from '../../../../services/storymanagement/SuggestionService';
import { createSuggestionService } from '../../../../services/storymanagement/SuggestionService';
import { useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { getContrastTextColor } from '@keres/shared';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

interface SuggestionListInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  type: SuggestionType;
  placeholder?: string;
  style?: any;
  storyId: string;
}

function appendUnique(current: string[], candidate: string): string[] {
  const trimmed = candidate.trim();
  if (!trimmed) return current;
  const key = trimmed.toLocaleLowerCase();
  if (current.some((value) => value.toLocaleLowerCase() === key)) return current;
  return [...current, trimmed];
}

/**
 * Multi-value counterpart of `SuggestionTextInput`: selected values as removable chips, free
 * text to insert a new item on the entity, and the same suggestion catalog (searchable) for
 * picking existing ones. The catalog is a helper, not a closed list.
 */
const SuggestionListInput: React.FC<SuggestionListInputProps> = ({
  values,
  onChange,
  type,
  placeholder,
  style,
  storyId,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { height: screenHeight } = useWindowDimensions();
  const commonInputStyles = getCommonInputStyles(colors);

  const [draft, setDraft] = useState('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<[string, number][]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const fetched = await suggestionService.getSuggestions(type, storyId);
      setSuggestions(fetched);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [suggestionService, type, storyId]);

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return suggestions;
    return suggestions.filter(([suggestion]) => suggestion.toLocaleLowerCase().includes(query));
  }, [searchQuery, suggestions]);

  const selectedKeys = useMemo(
    () => new Set(values.map((value) => value.toLocaleLowerCase())),
    [values],
  );

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSearchQuery('');
  }, []);

  const handleToggleSuggestions = () => {
    if (showSuggestions) {
      closeSuggestions();
    } else {
      setShowSuggestions(true);
      fetchSuggestions();
    }
  };

  const addDraft = () => {
    const next = appendUnique(values, draftRef.current);
    if (next !== values) {
      onChange(next);
    }
    setDraft('');
  };

  const removeValue = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  const toggleSuggestion = (suggestion: string) => {
    const key = suggestion.toLocaleLowerCase();
    if (selectedKeys.has(key)) {
      onChange(values.filter((item) => item.toLocaleLowerCase() !== key));
      return;
    }
    onChange(appendUnique(values, suggestion));
  };

  const pillBackgroundColor = colors.primaryContainer;
  const pillTextColor = getContrastTextColor(pillBackgroundColor);

  const styles = StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 6,
      // Espaço entre pílulas no contêiner: em cada pílula, a última linha ainda cobrava a
      // margem de baixo e sobrava um vão morto sob a fileira.
      gap: 8,
    },
    pill: {
      flexDirection: 'row',
      borderRadius: 15,
      paddingVertical: 5,
      paddingHorizontal: 10,
      alignItems: 'center',
      backgroundColor: pillBackgroundColor,
    },
    pillText: {
      fontSize: 14,
      color: pillTextColor,
    },
    removeButton: {
      marginLeft: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 5,
      backgroundColor: colors.surface,
      minHeight: 50,
    },
    draftInput: {
      flex: 1,
      borderWidth: 0,
      backgroundColor: 'transparent',
      marginBottom: 0,
    },
    suggestionButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      marginLeft: -1,
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
      flex: 1,
    },
    suggestionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    // Mesmo motivo do campo de opções: o visto reservado impede a linha de crescer ao ser
    // marcada.
    suggestionCheck: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionCount: {
      color: colors.textSecondary,
      fontSize: 16,
      marginRight: 8,
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
      {values.length > 0 && (
        <View style={styles.chipRow}>
          {values.map((value) => (
            <View key={value} style={styles.pill}>
              <Text style={styles.pillText}>{value}</Text>
              <TouchableOpacity
                testID={`suggestion-list-remove-${value}`}
                onPress={() => removeValue(value)}
                style={styles.removeButton}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={14} color={pillTextColor} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputWrapper}>
        <TextInput
          testID="suggestion-list-draft"
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          onSubmitEditing={addDraft}
          returnKeyType="done"
          blurOnSubmit={false}
          style={[commonInputStyles.input, styles.draftInput]}
          suppressInteractionBorder
        />
        <TouchableOpacity
          testID="suggestion-list-add"
          style={styles.suggestionButton}
          onPress={addDraft}
        >
          <Ionicons name="add" size={24} color={colors.onPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="suggestion-list-catalog"
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
          testID="suggestion-list-search"
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
            extraData={`${searchQuery}:${values.join('\0')}`}
            keyExtractor={(item) => item[0]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = selectedKeys.has(item[0].toLocaleLowerCase());
              return (
                <TouchableOpacity
                  testID={`suggestion-list-option-${item[0]}`}
                  style={styles.suggestionItem}
                  onPress={() => toggleSuggestion(item[0])}
                >
                  <Text style={styles.suggestionText}>{item[0]}</Text>
                  <View style={styles.suggestionMeta}>
                    {item[1] > 0 && <Text style={styles.suggestionCount}>{item[1]}</Text>}
                    <View style={styles.suggestionCheck}>
                      {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
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

export default SuggestionListInput;
