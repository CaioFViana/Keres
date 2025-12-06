import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../theme';
import Select from '../Select/Select'; // Assuming Select is here
import TextInput from '../TextInput/TextInput'; // Assuming TextInput is here

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
  emptyListComponent?: React.ReactElement;
}

const GenericFilterSortList = <T,>({
  data,
  renderItem,
  keyExtractor,
  onSearch,
  searchPlaceholder,
  currentSearchTerm, // Destructure new prop
  filterOptions,
  onFilterChange,
  selectedFilterValues, // Destructure new prop
  sortOptions,
  onSortChange,
  onSortDirectionChange,
  currentSortDirection,
  emptyListComponent,
}: GenericFilterSortListProps<T>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  // const [searchText, setSearchText] = useState(''); // Removed internal state
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(currentSortDirection);

  // Initialize selectedFilter with the prop, ensuring it's an array
  const [selectedFilter, setSelectedFilter] = useState<string[]>(selectedFilterValues || []);

  React.useEffect(() => {
    setSelectedFilter(selectedFilterValues || []);
  }, [selectedFilterValues]);


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
    setSelectedSort(value);
    onSortChange(value);
  };

  const handleSortDirectionToggle = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    onSortDirectionChange(newDirection);
  };


  const styles = StyleSheet.create({
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
    },
    filterSortControlsWrapper: {
      flexDirection: 'column',
      marginBottom: 5,
    },
    filterSortRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
    },
    selectContainer: {
      flex: 1,
      marginRight: 10,
      marginBottom: 10
    },
    sortDirectionButton: {
      padding: 8,
      borderRadius: 5,
      backgroundColor: colors.primary,
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

  const showFilter = filterOptions && filterOptions.length > 0;
  const showSort = sortOptions && sortOptions.length > 0;

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
      { (showFilter || showSort) && (
        <View style={styles.filterSortControlsWrapper}>
          {showFilter && (
            <View style={styles.filterSortRow}>
              <View style={styles.selectContainer}>
                <Select
                  options={filterOptions}
                  value={selectedFilter} // Pass array
                  onValueChange={handleFilterSelection} // Expects array
                  placeholder={t('filter_by_tags')}
                  multiple={true} // Enable multi-select
                />
              </View>
            </View>
          )}
          {showSort && (
            <View style={styles.filterSortRow}>
              <View style={styles.selectContainer}>
                <Select
                  options={sortOptions}
                  value={selectedSort}
                  onValueChange={handleSortSelection}
                  placeholder={t('sort_by')}
                />
              </View>
              <TouchableOpacity onPress={handleSortDirectionToggle} style={styles.sortDirectionButton}>
                <Ionicons
                  name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
          )}
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
