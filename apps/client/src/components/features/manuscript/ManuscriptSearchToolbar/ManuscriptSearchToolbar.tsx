import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

interface ManuscriptSearchToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  ordinal: number;
  total: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onSubmitQuery: () => void;
  onOpenIndex: () => void;
  /** Guide-tour anchor for the search row; the screen owns the tour. */
  searchAnchorRef: (node: unknown) => void;
}

/** Manuscript search row: index entry, query input, match stepper, hit counter. */
export function ManuscriptSearchToolbar({
  query,
  onQueryChange,
  ordinal,
  total,
  onPrevMatch,
  onNextMatch,
  onSubmitQuery,
  onOpenIndex,
  searchAnchorRef,
}: ManuscriptSearchToolbarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        searchInput: {
          flex: 1,
          color: colors.text,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 15,
        },
        searchNav: { padding: 8 },
        searchCount: {
          color: colors.textSecondary,
          fontSize: 13,
          minWidth: 64,
          textAlign: 'center',
        },
      }),
    [colors],
  );

  return (
    <>
      <View ref={searchAnchorRef} collapsable={false} style={styles.searchRow}>
        <TouchableOpacity
          testID="manuscript-index-open"
          style={styles.searchNav}
          accessibilityRole="button"
          accessibilityLabel={t('manuscript_index_open')}
          onPress={onOpenIndex}
        >
          <Ionicons name="list" size={22} color={colors.text} />
        </TouchableOpacity>
        <TextInput
          testID="manuscript-search"
          style={styles.searchInput}
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('manuscript_search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          onSubmitEditing={onSubmitQuery}
        />
        <TouchableOpacity
          testID="manuscript-search-prev"
          style={styles.searchNav}
          onPress={onPrevMatch}
          disabled={total === 0}
        >
          <Ionicons name="chevron-up" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="manuscript-search-next"
          style={styles.searchNav}
          onPress={onNextMatch}
          disabled={total === 0}
        >
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      {query.trim().length > 0 && (
        <Text style={styles.searchCount}>
          {total === 0
            ? t('manuscript_no_results')
            : t('manuscript_search_count', { current: ordinal + 1, total })}
        </Text>
      )}
    </>
  );
}
