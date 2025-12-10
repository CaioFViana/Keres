import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import Select from '../Select/Select'; // Assuming Select is here
import TextInput from '../TextInput/TextInput'; // Assuming TextInput is here

type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface GenericFilterSortListProps<T> {
  data: T[];
  renderItem: ({ item }: { item: T }) => React.ReactElement;
  keyExtractor: (item: T) => string;
  // Search Props
  onSearch: (searchText: string) => void;
  searchPlaceholder?: string;
  currentSearchTerm?: string; // Add currentSearchTerm prop
  // Filter Props
  filterOptions?: { label: string; value: string }[];
  onFilterChange: (filterValues: string[]) => void; // Changed to array
  selectedFilterValues: string[]; // New prop for selected filter values
  // Sort Props
  sortOptions?: { label: string; value: string }[];
  onSortChange: (sortValue: string | null) => void;
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  currentSortDirection: 'asc' | 'desc';
  currentSortValue?: string | null; // Added prop for current sort value
  emptyListComponent?: React.ReactElement;
  // Favorite Filter Props
  onFavoriteFilterChange?: (state: FavoriteFilterState) => void;
  currentFavoriteFilterState?: FavoriteFilterState;
}

const GenericFilterSortList = <T,>({
  data,
  renderItem,
  keyExtractor,
  onSearch,
  searchPlaceholder,
  currentSearchTerm,
  filterOptions,
  onFilterChange,
  selectedFilterValues,
  sortOptions,
  onSortChange,
  onSortDirectionChange,
  currentSortDirection,
  currentSortValue, // Destructure new prop
  emptyListComponent,
  onFavoriteFilterChange,
  currentFavoriteFilterState,
}: GenericFilterSortListProps<T>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // const [searchText, setSearchText] = useState(''); // Removed internal state
  const [selectedSort, setSelectedSort] = useState<string | null>(currentSortValue || null); // Initialize with prop
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(currentSortDirection);

  // Initialize selectedFilter with the prop, ensuring it's an array
  const [selectedFilter, setSelectedFilter] = useState<string[]>(selectedFilterValues || []);
  const [internalFavoriteFilterState, setInternalFavoriteFilterState] = useState<FavoriteFilterState>(currentFavoriteFilterState || 'all');

  React.useEffect(() => {
    setSelectedFilter(selectedFilterValues || []);
  }, [selectedFilterValues]);

  React.useEffect(() => {
    setInternalFavoriteFilterState(currentFavoriteFilterState || 'all');
  }, [currentFavoriteFilterState]);

  React.useEffect(() => {
    setSelectedSort(currentSortValue || null); // Sync with prop
  }, [currentSortValue]);

  const handleSearchTextChange = (text: string) => {
    // setSearchText(text); // No longer setting internal state
    onSearch(text);
  };

  const handleFilterSelection = (values: string | string[] | null) => { // Updated to handle array
    const newValues = Array.isArray(values) ? values : (values ? [values] : []);
    setSelectedFilter(newValues);
    onFilterChange(newValues);
  };

  const handleSortSelection = (value: string | null) => {
    // setSelectedSort is updated internally, but the source of truth is the prop for external control
    // setSelectedSort(value); // This line is not needed here anymore as state is synced with props
    onSortChange(value);
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    onSortDirectionChange(newDirection);
  };

  const handleFavoriteFilterToggle = () => {
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
      return 'ban-outline'; // Using 'ban-outline' to signify 'not favorite' (exclude)
    }
    return 'star-outline'; // Default for 'all'
  };

  const getFavoriteButtonColor = () => {
    if (internalFavoriteFilterState === 'favorite') {
      return colors.accent; // A distinct color when filtering for favorites
    } else if (internalFavoriteFilterState === 'not-favorite') {
      return colors.notification; // A distinct color when filtering for non-favorites
    }
    return colors.primary; // Default color
  };

  const showFilter = filterOptions && filterOptions.length > 0;
  const showSort = sortOptions && sortOptions.length > 0;
  const showFavoriteFilter = onFavoriteFilterChange; // Removed favoriteFilterOptionLabel from condition

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 10,
      backgroundColor: colors.background,
    },
    searchContainer: {
      marginBottom: 0,
      paddingTop: 5,
      paddingBottom: 0
    },
    searchBar: {
      width: '100%',
      marginBottom: 10
    },
    filterSortControlsWrapper: {
      flexDirection: 'column',
      marginBottom: 5,
    },
    filterSortRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10, // Changed from 5 to 10
    },
    selectContainer: {
      flex: 1,
    },
    selectContainerSort: {
      flex: 1,
      paddingRight: 10
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
      // No marginBottom here, marginRight applied conditionally in JSX
    },
    list: {
      flex: 1,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          placeholder={searchPlaceholder || t('search')}
          value={currentSearchTerm || ''} // Use prop for value
          onChangeText={handleSearchTextChange}
          style={styles.searchBar}
        />
      </View>
      { (showFilter || showSort || showFavoriteFilter) && (
        <View style={styles.filterSortControlsWrapper}>
          {showFilter && (
            <View style={styles.filterSortRow}>
              <View style={[styles.selectContainer, (showFavoriteFilter || showSort) && { flex: 1 }]}>
                <Select
                  options={filterOptions || []} // Provide empty array as fallback
                  value={selectedFilter} // Pass array
                  onValueChange={handleFilterSelection} // Expects array
                  placeholder={t('filter_by_tags')}
                  multiple={true} // Enable multi-select
                />
              </View>
            </View>
          )}
          <View style={styles.filterSortRow}>
            <View style={styles.selectContainerSort}>
              <Select
                options={sortOptions || []} // Provide empty array as fallback
                value={selectedSort}
                onValueChange={handleSortSelection}
                placeholder={t('sort_by')}
              />
            </View>
            <TouchableOpacity
              onPress={handleFavoriteFilterToggle}
              style={[
                styles.favoriteFilterButton,
                { backgroundColor: getFavoriteButtonColor() },
                { marginRight: 10 }, // Always add marginRight if sort is next to it
              ]}
            >
              <Ionicons
                name={getFavoriteButtonIcon()}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSortDirectionToggle} style={styles.sortDirectionButton}>
              <Ionicons
                name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={emptyListComponent || <Text style={styles.emptyText}>{t('no_items_found')}</Text>}
        style={styles.list}
      />
    </View>
  );
};

export default GenericFilterSortList;
