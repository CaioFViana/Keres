import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import ItemListItem from '../../components/listitem/ItemListItem';
import { useDrizzle } from '../../db';
import { ItemSelect } from '../../db/schemas/items';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ItemStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useItemStore } from '../../state/itemStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ItemsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemsStack'>,
  NativeStackNavigationProp<ItemStackParamList, 'ItemDetail'>
>;

const ItemListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ItemsScreenNavigationProp>();

  const {
    items,
    searchTerm: storeSearchTerm,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    loading,
    error,
    fetchItems,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setAdvancedSearchCriteria,
  } = useItemStore();

  const [searchQuery, setSearchQuery] = useState(storeSearchTerm);

  const debouncedSetStoreSearchTerm = useMemo(
    () => debounce((term: string) => setStoreSearchTerm(term), 1000),
    [setStoreSearchTerm]
  );

  useEffect(() => {
    debouncedSetStoreSearchTerm(searchQuery);
    return () => {
      debouncedSetStoreSearchTerm.cancel && debouncedSetStoreSearchTerm.cancel();
    };
  }, [searchQuery, debouncedSetStoreSearchTerm]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService]);

  useEffect(() => {
    fetchItems();
  }, [storeSearchTerm, activeSort, sortDirection, advancedSearchCriteria, fetchItems]);

  useEffect(() => {
    const handleEntityChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchItems();
      }
    };
    entityEventEmitter.on('item_changed', handleEntityChange);
    return () => {
      entityEventEmitter.off('item_changed', handleEntityChange);
    };
  }, [selectedStory?.id, fetchItems]);

  const handleViewDetails = useCallback((itemId: string) => {
    navigation.navigate('ItemDetail', { itemId });
  }, [navigation]);

  const memoizedItemListItem = useCallback(({ item }: { item: ItemSelect }) => (
    <ItemListItem item={item} onViewDetails={handleViewDetails} />
  ), [handleViewDetails]);

  const memoizedSortOptions = useMemo(() => ([
    { label: t('sort_by_name'), value: 'name' },
    { label: t('sort_by_category'), value: 'category' },
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' }
  ]), [t]);

  const handleSearch = useCallback((term: string) => setSearchQuery(term), []);
  const handleSortChange = useCallback((sortBy: string | null) => setSort(sortBy, sortDirection), [setSort, sortDirection]);
  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => setSort(activeSort, direction), [setSort, activeSort]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('items_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('ItemForm', {})} style={styles.headerButton}>
              <Ionicons name="add" size={30} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
    buttonContainer: { marginTop: 20 },
    filterContainer: { flexDirection: 'row', padding:0, paddingBottom: 10, zIndex: 1000 },
  });

  // Temporarily simplified filter component for Items
  const filterComponent = (
    <View style={styles.filterContainer}>
      {/* Add item-specific filters here later if needed, e.g., by category */}
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_items')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={items}
        renderItem={memoizedItemListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_items')}
        currentSearchTerm={searchQuery}
        filterComponent={filterComponent}
        filterOptions={[]} // No specific filter options for now
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        disableTagFilter={true}
        entityName="Item"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={false} // Items have isFavorite field
      />
    </View>
  );
};

export default ItemListScreen;