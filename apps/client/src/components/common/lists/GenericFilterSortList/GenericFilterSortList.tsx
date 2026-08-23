import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../../../theme';
import AdvancedSearchModal from '@/src/components/common/modals/AdvancedSearchModal/AdvancedSearchModal';
import Select from '@/src/components/common/inputs/Select/Select';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields'; // Import metadata
import { STORY_SCHEMA_ENTITY_TYPES } from '@keres/shared';

import type { FavoriteFilterState } from '../../../../types/entityFilters';

interface GenericFilterSortListProps<T> {
  data: T[];
  renderItem: ({ item }: { item: T }) => React.ReactElement;
  keyExtractor: (item: T) => string;
  // Search Props
  onSearch: (searchText: string) => void;
  /** Enter (web) / the mobile keyboard's return key: commits the search immediately and blurs. */
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  currentSearchTerm?: string;
  // Filter Props
  filterComponent?: React.ReactNode;
  filterOptions?: { label: string; value: string; color?: string | null }[];
  onFilterChange: (filterValues: string[]) => void;
  selectedFilterValues: string[];
  // Sort Props
  sortOptions?: { label: string; value: string }[];
  onSortChange: (sortValue: string | null) => void;
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  currentSortDirection: 'asc' | 'desc';
  currentSortValue?: string | null;
  emptyListComponent?: React.ReactElement;
  // Favorite Filter Props
  onFavoriteFilterChange?: (state: FavoriteFilterState) => void;
  currentFavoriteFilterState?: FavoriteFilterState;
  disableFavoriteFilter?: boolean;
  // Advanced Search Props
  entityName?: string;
  storyId?: string;
  onAdvancedSearch?: (criteria: { [key: string]: any }) => void;
  currentAdvancedSearchCriteria?: { [key: string]: any };
  disableTagFilter?: boolean;
  isLoading?: boolean;
  /** Contextual count supplied by composite lists, e.g. items nested under each result. */
  resultsMeta?: string;
  /**
   * Colunas da lista. A galeria mostra miniaturas em grade; as demais telas são listas de
   * uma coluna e não passam nada.
   */
  numColumns?: number;
  columnWrapperStyle?: StyleProp<ViewStyle>;
}

const GenericFilterSortList = <T,>({
  data,
  renderItem,
  keyExtractor,
  onSearch,
  onSearchSubmit,
  searchPlaceholder,
  currentSearchTerm,
  filterComponent,
  filterOptions,
  onFilterChange,
  selectedFilterValues,
  sortOptions,
  onSortChange,
  onSortDirectionChange,
  currentSortDirection,
  currentSortValue,
  emptyListComponent,
  onFavoriteFilterChange,
  currentFavoriteFilterState,
  entityName,
  storyId,
  onAdvancedSearch,
  currentAdvancedSearchCriteria,
  disableFavoriteFilter = false,
  disableTagFilter = false,
  isLoading = false,
  resultsMeta,
  numColumns = 1,
  columnWrapperStyle,
}: GenericFilterSortListProps<T>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [selectedSort, setSelectedSort] = useState<string | null>(currentSortValue || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(currentSortDirection);
  const [selectedFilter, setSelectedFilter] = useState<string[]>(selectedFilterValues || []);
  const [internalFavoriteFilterState, setInternalFavoriteFilterState] =
    useState<FavoriteFilterState>(currentFavoriteFilterState || 'all');
  const [isAdvancedSearchModalVisible, setIsAdvancedSearchModalVisible] = useState(false);

  // Calculate if there are any searchable fields for the current entity - either native
  // (static registry) or, for entity types that support Story Schema custom attributes, the
  // possibility of one existing (or being added later) is enough to keep the button live
  // instead of needing a separate story-scoped fetch just to decide visibility.
  const hasAdvancedSearchFields = useMemo(() => {
    if (!entityName) return false;
    const metadata = entityFieldMetadata[entityName];
    const hasNativeSearchableFields = !!metadata && metadata.some((field) => field.isSearchable);
    const supportsCustomAttributes = (STORY_SCHEMA_ENTITY_TYPES as readonly string[]).includes(
      entityName,
    );
    return hasNativeSearchableFields || supportsCustomAttributes;
  }, [entityName]);

  React.useEffect(() => {
    setSelectedFilter(selectedFilterValues || []);
  }, [selectedFilterValues]);

  React.useEffect(() => {
    setInternalFavoriteFilterState(currentFavoriteFilterState || 'all');
  }, [currentFavoriteFilterState]);

  React.useEffect(() => {
    setSelectedSort(currentSortValue || null);
  }, [currentSortValue]);

  const handleSearchTextChange = (text: string) => {
    onSearch(text);
  };

  /**
   * The search input still updates on every keystroke (kept live via `onSearch`), but the
   * committed search that drives the fetch is debounced upstream so a paused fetch doesn't
   * fire on every character. Enter/the mobile return key skips that wait and blurs, rather
   * than leaving the keyboard open until the debounce catches up.
   */
  const handleSearchSubmitEditing = useCallback(() => {
    Keyboard.dismiss();
    onSearchSubmit?.();
  }, [onSearchSubmit]);

  const handleFilterSelection = (values: string | string[] | null) => {
    const newValues = Array.isArray(values) ? values : values ? [values] : [];
    setSelectedFilter(newValues);
    onFilterChange(newValues);
  };

  const handleSortSelection = (value: string | null) => {
    onSortChange(value);
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    onSortDirectionChange(newDirection);
  };

  const handleFavoriteFilterToggle = () => {
    if (disableFavoriteFilter) return;
    let newState: FavoriteFilterState;
    if (internalFavoriteFilterState === 'all') {
      newState = 'favorite';
    } else if (internalFavoriteFilterState === 'favorite') {
      newState = 'not-favorite';
    } else {
      newState = 'all';
    }
    setInternalFavoriteFilterState(newState);
    onFavoriteFilterChange && onFavoriteFilterChange(newState);
  };

  const getFavoriteButtonIcon = (): keyof typeof Ionicons.glyphMap => {
    if (internalFavoriteFilterState === 'favorite') {
      return 'star';
    } else if (internalFavoriteFilterState === 'not-favorite') {
      return 'ban-outline';
    }
    return 'star-outline';
  };

  const getFavoriteButtonColor = () => {
    if (internalFavoriteFilterState === 'favorite') {
      return colors.accent;
    } else if (internalFavoriteFilterState === 'not-favorite') {
      return colors.notification;
    }
    return colors.primary;
  };

  const handleOpenAdvancedSearchModal = useCallback(() => {
    if (hasAdvancedSearchFields) {
      // Only open if there are fields
      setIsAdvancedSearchModalVisible(true);
    }
  }, [hasAdvancedSearchFields]);
  const handleCloseAdvancedSearchModal = useCallback(
    () => setIsAdvancedSearchModalVisible(false),
    [],
  );
  const handleAdvancedSearchSubmit = useCallback(
    (criteria: { [key: string]: any }) => {
      onAdvancedSearch && onAdvancedSearch(criteria);
      setIsAdvancedSearchModalVisible(false);
    },
    [onAdvancedSearch],
  );

  const usesColoredFilterOptions = !!filterOptions?.some((option) => !!option.color);

  return (
    <View style={styles(colors).container}>
      <View style={styles(colors).searchContainer}>
        <TextInput
          placeholder={searchPlaceholder || t('search')}
          value={currentSearchTerm || ''}
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSearchSubmitEditing}
          returnKeyType="search"
          style={styles(colors).searchBar}
        />
      </View>

      {filterComponent}

      <View style={styles(colors).filterSortControlsWrapper}>
        <View style={styles(colors).filterSortRow}>
          <View style={[styles(colors).selectContainer, { flex: 1 }]}>
            {usesColoredFilterOptions ? (
              <MultiSelectPill
                options={(filterOptions || []).map((option) => ({
                  ...option,
                  color: option.color || undefined,
                }))}
                selectedValues={selectedFilter}
                onSelectionChange={handleFilterSelection}
                placeholder={t('filter_by_tags')}
                style={{ marginBottom: 0 }}
                triggerStyle={{
                  borderColor: colors.primary,
                  borderRadius: 5,
                  height: 50,
                  minHeight: 50,
                  paddingVertical: 6,
                  flexWrap: 'nowrap',
                  overflow: 'hidden',
                  justifyContent: 'center',
                }}
                pillStyle={{ marginBottom: 0 }}
              />
            ) : (
              <Select
                options={filterOptions || []}
                value={selectedFilter}
                onValueChange={handleFilterSelection}
                placeholder={t('filter_by_tags')}
                multiple={true}
                disabled={disableTagFilter}
              />
            )}
          </View>
          <TouchableOpacity
            onPress={handleOpenAdvancedSearchModal}
            style={styles(colors).advancedSearchButton}
            disabled={!hasAdvancedSearchFields} // Disable if no fields are searchable
          >
            <Ionicons
              name="search-outline"
              size={24}
              color={hasAdvancedSearchFields ? colors.text : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles(colors).filterSortRow}>
          <View style={styles(colors).selectContainerSort}>
            <Select
              options={sortOptions || []}
              value={selectedSort}
              onValueChange={handleSortSelection}
              placeholder={t('sort_by')}
            />
          </View>
          {!disableFavoriteFilter && (
            <TouchableOpacity
              onPress={handleFavoriteFilterToggle}
              style={[
                styles(colors).favoriteFilterButton,
                { backgroundColor: getFavoriteButtonColor() },
                { marginRight: 10 },
              ]}
            >
              <Ionicons name={getFavoriteButtonIcon()} size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSortDirectionToggle}
            style={styles(colors).sortDirectionButton}
          >
            <Ionicons
              name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles(colors).resultsRow}>
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles(colors).resultsLoadingIndicator}
          />
        )}
        <Text style={styles(colors).resultsCountText}>
          {t('total_results_found', { count: data.length })}
          {resultsMeta ? ` (${resultsMeta})` : ''}
        </Text>
      </View>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
        ListEmptyComponent={
          emptyListComponent || <Text style={styles(colors).emptyText}>{t('no_items_found')}</Text>
        }
        style={styles(colors).list}
      />
      {storyId &&
        entityName &&
        onAdvancedSearch &&
        hasAdvancedSearchFields && ( // Only render modal if there are searchable fields
          <AdvancedSearchModal
            entityName={entityName}
            storyId={storyId}
            isVisible={isAdvancedSearchModalVisible}
            onClose={handleCloseAdvancedSearchModal}
            onSearch={handleAdvancedSearchSubmit}
            initialCriteria={currentAdvancedSearchCriteria}
          />
        )}
    </View>
  );
};

const styles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 10,
      backgroundColor: colors.background,
    },
    searchContainer: {
      marginBottom: 0,
      paddingTop: 5,
      paddingBottom: 0,
    },
    searchBar: {
      width: '100%',
      marginBottom: 10,
    },
    filterSortControlsWrapper: {
      flexDirection: 'column',
      marginBottom: 5,
      zIndex: 1, // Add zIndex to create a stacking context
    },
    filterSortRow: {
      flexDirection: 'row',
      marginBottom: 10,
      alignItems: 'center',
    },
    selectContainer: {
      flex: 1,
    },
    selectContainerSort: {
      flex: 1,
      paddingRight: 10,
    },
    sortDirectionButton: {
      padding: 12,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    favoriteFilterButton: {
      padding: 12,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flex: 1,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
    advancedSearchButton: {
      padding: 12,
      borderRadius: 5,
      backgroundColor: colors.primary,
      marginLeft: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resultsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingLeft: 10,
    },
    resultsLoadingIndicator: {
      marginRight: 8,
    },
    resultsCountText: {
      color: colors.textSecondary,
      textAlign: 'left',
      fontSize: 16,
    },
  });

export default GenericFilterSortList;
