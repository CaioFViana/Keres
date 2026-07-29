import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import ItemListItem from '../../components/listitem/ItemListItem';
import { ItemSelect } from '../../db/schemas/items';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { ItemStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useItemStore } from '../../state/itemStore';
import { useTheme } from '../../theme';

export type ItemsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemsStack'>,
  NativeStackNavigationProp<ItemStackParamList, 'ItemDetail'>
>;

const ItemListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemsScreenNavigationProp>();

  const {
    items,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    handleSearch,
    handleSortChange,
    handleSortDirectionChange,
    setAdvancedSearchCriteria,
  } = useEntityListScreen({
    useStore: useItemStore,
    collectionKey: 'items',
    changeEvent: 'item_changed',
  });

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
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
    filterContainer: { flexDirection: 'row', padding:0, paddingBottom: 10, zIndex: 1000 },
  });

  // Temporarily simplified filter component for Items
  const filterComponent = (
    <View style={styles.filterContainer}>
      {/* Add item-specific filters here later if needed, e.g., by category */}
    </View>
  );

  if (loading && items.length === 0) {
    return <ScreenLoading message={t('loading_items')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
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
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={false} // Items have isFavorite field
      />
    </View>
  );
};

export default ItemListScreen;