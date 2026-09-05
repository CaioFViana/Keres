import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
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
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

export type LocationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationDetail'>
>;

const LocationsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<LocationsScreenNavigationProp>();

  const {
    listProps,
    items: locations,
    isInitialLoading,
    error,
    storyId,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
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

  const styles = StyleSheet.create({ ...commonScreenStyleDefs(colors) });

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

  useScreenHeader({
    target: 'parent',
    title: term('Location', true),
    actions: [
      {
        id: 'action-0',
        icon: 'git-network-outline',
        label: t('location_graph_title'),
        onPress: () => navigation.navigate('LocationView'),
      },
      {
        id: 'action-1',
        icon: 'map-outline',
        label: t('location_map_list_title'),
        onPress: () => navigation.navigate('LocationMapList'),
      },
      {
        id: 'action-2',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('LocationForm', { locationId: undefined }),
        visible: !!canEdit,
      },
    ],
  });

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
    return (
      <ScreenLoading
        message={t('vocabulary_loading_entities', { entities: term('Location', true) })}
      />
    );
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        {...listProps}
        data={locations}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        searchPlaceholder={t('search_entities', { entities: term('Location', true) })}
        filterOptions={memoizedTagFilterOptions}
        sortOptions={memoizedSortOptions}
        entityName="Location"
        storyId={storyId || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
      />
    </View>
  );
};

export default LocationsScreen;
