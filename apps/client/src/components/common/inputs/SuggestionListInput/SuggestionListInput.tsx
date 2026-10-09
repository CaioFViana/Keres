import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SuggestionType } from '../../../../services/storymanagement/SuggestionService';
import { type ThemeColors, useTheme } from '../../../../theme';
import { getCommonInputStyles } from '../../../../theme/commonStyles';
import { typography } from '../../../../theme/tokens';
import { getContrastTextColor } from '@keres/shared';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import SuggestionCatalogModal from '../SuggestionCatalogModal/SuggestionCatalogModal';
import { useSuggestionCatalog } from '../SuggestionCatalogModal/useSuggestionCatalog';
import { useThemedStyles } from '../../../../theme/useThemedStyles';

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
  const commonInputStyles = getCommonInputStyles(colors);
  const {
    suggestions,
    loading: loadingSuggestions,
    showSuggestions,
    searchQuery,
    setSearchQuery,
    closeSuggestions,
    toggleSuggestions,
  } = useSuggestionCatalog(storyId, type);

  const [draft, setDraft] = useState('');
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const selectedKeys = useMemo(
    () => new Set(values.map((value) => value.toLocaleLowerCase())),
    [values],
  );

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

  const styles = useThemedStyles(createStyles, [pillBackgroundColor, pillTextColor]);

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
          onPress={toggleSuggestions}
          disabled={loadingSuggestions}
        >
          {loadingSuggestions ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="bulb-outline" size={24} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>

      <SuggestionCatalogModal
        visible={showSuggestions}
        loading={loadingSuggestions}
        suggestions={suggestions}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClose={closeSuggestions}
        searchTestID="suggestion-list-search"
        extraData={`${searchQuery}:${values.join('\0')}`}
        renderOption={(item) => {
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
      />
    </View>
  );
};

const createStyles = (
  colors: ThemeColors,
  [pillBackgroundColor, pillTextColor]: [string, string],
) =>
  StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 6,
      // Spacing between pills belongs to the container: with it on each pill, the last row still charged its
      // bottom margin and left dead space under the row.
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
      ...typography.bodyLarge,
      color: colors.text,
      flex: 1,
    },
    suggestionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    // The same reason as the options field: the reserved checkmark stops the row from growing when it is
    // ticked.
    suggestionCheck: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionCount: {
      ...typography.bodyLarge,
      color: colors.textSecondary,
      marginRight: 8,
    },
  });

export default SuggestionListInput;
