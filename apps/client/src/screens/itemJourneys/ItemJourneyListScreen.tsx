import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import ItemJourneyListItem from '../../components/listitem/ItemJourneyListItem';
import { ItemJourneySelect } from '../../db/schemas/itemJourneys';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { ItemJourneyStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useItemJourneyStore } from '../../state/itemJourneyStore';
import { useTheme } from '../../theme';

export type ItemJourneysScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemJourneysStack'>,
  NativeStackNavigationProp<ItemJourneyStackParamList, 'ItemJourneyDetail'>
>;

const ItemJourneyListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();

  const {
    items: itemJourneys,
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
    useStore: useItemJourneyStore,
    collectionKey: 'itemJourneys',
    changeEvent: 'item_journey_changed',
  });

  const handleViewDetails = useCallback((itemJourneyId: string) => {
    navigation.navigate('ItemJourneyDetail', { itemJourneyId });
  }, [navigation]);

  const memoizedItemJourneyListItem = useCallback(({ item }: { item: ItemJourneySelect }) => (
    <ItemJourneyListItem itemJourney={item} onViewDetails={handleViewDetails} />
  ), [handleViewDetails]);

  const memoizedSortOptions = useMemo(() => ([
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' }
    // Add more sort options as needed for ItemJourney
  ]), [t]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('item_journeys_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('ItemJourneyForm', {})} style={styles.headerButton}>
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

  const filterComponent = (
    <View style={styles.filterContainer}>
    </View>
  );

  if (loading && itemJourneys.length === 0) {
    return <ScreenLoading message={t('loading_item_journeys')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={itemJourneys}
        renderItem={memoizedItemJourneyListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_item_journeys')}
        currentSearchTerm={searchQuery}
        filterComponent={filterComponent}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        disableTagFilter={true}
        entityName="ItemJourney"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={false} // Assuming ItemJourney has isFavorite field
      />
    </View>
  );
};

export default ItemJourneyListScreen;