import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import LocationListItem from '../../components/listitem/LocationListItem';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { LocationStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { LocationWithTags } from '../../services/storymanagement/LocationService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useLocationStore } from '../../state/locationStore';
import { useTheme } from '../../theme';

export type LocationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationDetail'>
>;

const LocationsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<LocationsScreenNavigationProp>();

  const {
    items: locations,
    loading,
    error,
    storyId,
    searchQuery,
    activeFilterTags,
    favoriteFilterState,
    activeSort,
    sortDirection,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    handleSearch,
    handleSortChange,
    handleSortDirectionChange,
    handleFilterTagsChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria: setStoreAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useLocationStore,
    collectionKey: 'locations',
    changeEvent: 'location_changed',
  });

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  // Tags power the filter dropdown, so they're fetched here rather than by the list hook.
  const fetchTags = useCallback(async () => {
    if (!storyId) {
      setAllTags([]);
      return;
    }
    try {
      const fetchedTags = await tagService.getTagsByStoryId(storyId);
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [storyId, tagService]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('locations_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('LocationForm', { locationId: undefined })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleToggleFavorite = useCallback(async (locationId: string, isFavorite: boolean) => {
    await toggleFavorite(locationId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((locationId: string) => {
    navigation.navigate('LocationDetail', { locationId });
  }, [navigation]);

  const memoizedRenderItem = useCallback(({ item }: { item: LocationWithTags }) => (
    <LocationListItem
      location={item}
      onToggleFavorite={handleToggleFavorite}
      onViewDetails={handleViewDetails}
    />
  ), [handleToggleFavorite, handleViewDetails]);

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  if (loading) {
    return <ScreenLoading message={t('loading_locations')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={locations}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_locations')}
        currentSearchTerm={searchQuery}
        filterOptions={memoizedTagFilterOptions}
        onFilterChange={handleFilterTagsChange}
        selectedFilterValues={activeFilterTags}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        entityName="Location"
        storyId={storyId || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
      />
    </View>
  );
};

export default LocationsScreen;