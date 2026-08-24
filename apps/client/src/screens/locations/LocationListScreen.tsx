import { Ionicons } from '@expo/vector-icons';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp} from '@react-navigation/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import LocationListItem from '@/src/components/features/list-items/LocationListItem';
import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  LocationStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import type { LocationWithTags } from '../../services/storymanagement/LocationService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useLocationStore } from '../../state/locationStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';

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
    isInitialLoading,
    error,
    storyId,
    searchQuery,
    activeFilterTags,
    favoriteFilterState,
    activeSort,
    sortDirection,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
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
  const { canEdit } = useStoryRole(storyId);

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    headerRightContainer: { flexDirection: 'row', marginRight: 15 },
    headerButton: { marginLeft: 15 },
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

  useEffect(() => {
    const handleTagChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchTags();
    };
    entityEventEmitter.on('tag_changed', handleTagChange);
    return () => entityEventEmitter.off('tag_changed', handleTagChange);
  }, [fetchTags, storyId]);

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('locations_title'));
      navigation.getParent()?.setOptions({
        title: t('locations_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('LocationView')}
              style={styles.headerButton}
              accessibilityLabel={t('location_graph_title')}
            >
              <Ionicons name="git-network-outline" size={26} color={colors.text} />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('LocationForm', { locationId: undefined })}
                style={styles.headerButton}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [navigation, colors.text, t, styles.headerRightContainer, styles.headerButton, canEdit]),
  );

  const handleToggleFavorite = useCallback(
    async (locationId: string, isFavorite: boolean) => {
      await toggleFavorite(locationId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (locationId: string) => {
      navigation.navigate('LocationDetail', { locationId });
    },
    [navigation],
  );

  const memoizedRenderItem = useCallback(
    ({ item }: { item: LocationWithTags }) => (
      <LocationListItem
        location={item}
        onToggleFavorite={handleToggleFavorite}
        onViewDetails={handleViewDetails}
      />
    ),
    [handleToggleFavorite, handleViewDetails],
  );

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id, color: tag.color }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  if (isInitialLoading) {
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
        onSearchSubmit={handleSearchSubmit}
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
        isLoading={loading}
      />
    </View>
  );
};

export default LocationsScreen;
