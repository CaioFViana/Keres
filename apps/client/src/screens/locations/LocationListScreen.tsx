import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import LocationListItem from '../../components/listitem/LocationListItem';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { LocationStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { FavoriteFilterState, LocationWithTags } from '../../services/LocationService';
import { createTagService } from '../../services/TagService';
import { useLocationStore } from '../../state/locationStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type LocationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationDetail'>
>;

const LocationsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<LocationsScreenNavigationProp>();

  // Use the location store
  const {
    locations,
    searchTerm: storeSearchTerm,
    activeFilterTags,
    favoriteFilterState,
    activeSort,
    sortDirection,
    loading,
    error,
    setDbAndStoryId,
    initializeService,
    fetchLocations,
    setSearchTerm: setStoreSearchTerm,
    setFilterTags,
    setFavoriteFilter,
    setSort,
    toggleFavorite,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    setAdvancedSearchCriteria: setStoreAdvancedSearchCriteria,
  } = useLocationStore();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;
  const [searchQuery, setSearchQuery] = useState(storeSearchTerm);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    errorText: {
      color: colors.error,
    },
    buttonContainer: {
      marginTop: 20,
    },
  });

  const fetchTags = useCallback(async () => {
    if (!selectedStory?.id) {
      setAllTags([]);
      return;
    }
    try {
      const fetchedTags = await tagService.getTagsByStoryId(selectedStory.id);
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [selectedStory?.id, tagService]);

  useEffect(() => {
    const handler = debounce(() => {
      setStoreSearchTerm(searchQuery);
    }, 1000);

    handler();

    return () => {
      handler.cancel && handler.cancel();
    };
  }, [searchQuery, setStoreSearchTerm]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      fetchTags();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService, fetchTags]);

  useEffect(() => {
    fetchLocations();
  }, [storeSearchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, storeAdvancedSearchCriteria, fetchLocations]);

  useEffect(() => {
    const handleLocationChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchLocations();
      }
    };

    entityEventEmitter.on('location_changed', handleLocationChange);

    return () => {
      entityEventEmitter.off('location_changed', handleLocationChange);
    };
  }, [selectedStory?.id, fetchLocations]);

  useEffect(() => {
    const handleReset = () => {
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };

    entityEventEmitter.on('location_navigation_reset', handleReset);

    return () => {
      entityEventEmitter.off('location_navigation_reset', handleReset);
    };
  }, [navigation]);

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

  const handleSortChange = useCallback((sortBy: string | null) => {
    setSort(sortBy, sortDirection);
  }, [setSort, sortDirection]);

  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setSort(activeSort, direction);
  }, [setSort, activeSort]);

  const handleSearch = useCallback((term: string) => {
    setSearchQuery(term);
  }, [setSearchQuery]);

  const handleFilterChange = useCallback((selectedValues: string[]) => {
    setFilterTags(selectedValues);
  }, [setFilterTags]);

  const handleFavoriteFilterChange = useCallback((state: FavoriteFilterState) => {
    setFavoriteFilter(state);
  }, [setFavoriteFilter]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_locations')}</Text>
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
        data={locations}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_locations')}
        currentSearchTerm={searchQuery}
        filterOptions={memoizedTagFilterOptions}
        onFilterChange={handleFilterChange}
        selectedFilterValues={activeFilterTags}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        entityName="Location"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
      />
    </View>
  );
};

export default LocationsScreen;