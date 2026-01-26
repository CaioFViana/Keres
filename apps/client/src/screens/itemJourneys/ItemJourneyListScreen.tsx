import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import ItemJourneyListItem from '../../components/listitem/ItemJourneyListItem';
import { useDrizzle } from '../../db';
import { ItemJourneySelect } from '../../db/schemas/itemJourneys';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ItemJourneyStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useItemJourneyStore } from '../../state/itemJourneyStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ItemJourneysScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ItemJourneysStack'>,
  NativeStackNavigationProp<ItemJourneyStackParamList, 'ItemJourneyDetail'>
>;

const ItemJourneyListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();

  const {
    itemJourneys,
    searchTerm: storeSearchTerm,
    activeSort,
    sortDirection,
    advancedSearchCriteria,
    loading,
    error,
    fetchItemJourneys,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setAdvancedSearchCriteria,
  } = useItemJourneyStore();

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
    fetchItemJourneys();
  }, [storeSearchTerm, activeSort, sortDirection, advancedSearchCriteria, fetchItemJourneys]);

  useEffect(() => {
    const handleEntityChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchItemJourneys();
      }
    };
    entityEventEmitter.on('item_journey_changed', handleEntityChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleEntityChange);
    };
  }, [selectedStory?.id, fetchItemJourneys]);

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

  const handleSearch = useCallback((term: string) => setSearchQuery(term), []);
  const handleSortChange = useCallback((sortBy: string | null) => setSort(sortBy, sortDirection), [setSort, sortDirection]);
  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => setSort(activeSort, direction), [setSort, activeSort]);

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
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
    buttonContainer: { marginTop: 20 },
    filterContainer: { flexDirection: 'row', padding:0, paddingBottom: 10, zIndex: 1000 },
  });

  const filterComponent = (
    <View style={styles.filterContainer}>
    </View>
  );

  if (loading && itemJourneys.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_item_journeys')}</Text>
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
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
        disableFavoriteFilter={false} // Assuming ItemJourney has isFavorite field
      />
    </View>
  );
};

export default ItemJourneyListScreen;