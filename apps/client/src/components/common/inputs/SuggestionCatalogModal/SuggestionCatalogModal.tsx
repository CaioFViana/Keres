import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../../theme';

export type SuggestionCatalogEntry = [string, number];

interface SuggestionCatalogModalProps {
  visible: boolean;
  loading: boolean;
  suggestions: SuggestionCatalogEntry[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  searchTestID?: string;
  /** Forces the list to redraw when something outside the catalog changes its rows. */
  extraData?: unknown;
  renderOption: (entry: SuggestionCatalogEntry) => React.ReactElement;
}

/**
 * The searchable catalog picker shared by the suggestion inputs: a search field, the filtered
 * entries (each row drawn by the caller), a spinner while loading and a close button.
 */
const SuggestionCatalogModal: React.FC<SuggestionCatalogModalProps> = ({
  visible,
  loading,
  suggestions,
  searchQuery,
  onSearchChange,
  onClose,
  searchTestID,
  extraData,
  renderOption,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return suggestions;
    return suggestions.filter(([suggestion]) => suggestion.toLocaleLowerCase().includes(query));
  }, [searchQuery, suggestions]);

  const styles = StyleSheet.create({
    searchInput: {
      width: '100%',
      marginBottom: 10,
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
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      inset="compact"
      maxHeight={Math.min(screenHeight * 0.78, 680)}
    >
      <TextInput
        testID={searchTestID}
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder={t('search')}
        style={styles.searchInput}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.suggestionsList}
          data={filteredSuggestions}
          extraData={extraData}
          keyExtractor={(item) => item[0]}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => renderOption(item)}
          ListEmptyComponent={
            <Text style={styles.noSuggestionsText}>{t('no_suggestions_available')}</Text>
          }
        />
      )}
      <Button onPress={onClose} style={styles.closeButton}>
        {t('close')}
      </Button>
    </ResponsiveModal>
  );
};

export default SuggestionCatalogModal;
