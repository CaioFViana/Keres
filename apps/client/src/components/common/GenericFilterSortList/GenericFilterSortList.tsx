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
  // Filter Props
  filterOptions?: { label: string; value: string }[];
  onFilterChange: (filterValue: string | null) => void;
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
  filterOptions,
  onFilterChange,
  sortOptions,
  onSortChange,
  onSortDirectionChange,
  currentSortDirection,
  emptyListComponent,
}: GenericFilterSortListProps<T>) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(currentSortDirection);

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);
    onSearch(text);
  };

  const handleFilterSelection = (value: string | null) => {
    setSelectedFilter(value);
    onFilterChange(value);
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
          value={searchText}
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
                  value={selectedFilter}
                  onValueChange={handleFilterSelection}
                  placeholder={t('filter')}
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
