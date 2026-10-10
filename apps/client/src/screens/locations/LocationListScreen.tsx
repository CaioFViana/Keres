import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import LocationListItem from '@/src/components/features/list-items/LocationListItem';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import OutsideArcNotice from '../../components/features/arcs/OutsideArcNotice';
import { useEntityArcScope } from '../../hooks/useEntityArcScope';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryTagFilterOptions } from '../../hooks/useStoryTagFilterOptions';
import type {
  LocationStackParamList,
  MainSystemDrawerParamList,
} from '../../navigation/MainSystemStack';
import type { LocationWithTags } from '../../services/storymanagement/LocationService';
import { useLocationStore } from '../../state/locationStore';
import { type ThemeColors } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';

export type LocationsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'LocationsStack'>,
  NativeStackNavigationProp<LocationStackParamList, 'LocationDetail'>
>;

const LocationsScreen = () => {
  useBackButtonHandler();
  useScreenTour('LocationsStack');
  const listAnchorRef = useScreenAnchor('Locations', 'list');
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const navigation = useNavigation<LocationsScreenNavigationProp>();

  const {
    listProps,
    items: locations,
    isInitialLoading,
    error,
    storyId,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    setAdvancedSearchCriteria: setStoreAdvancedSearchCriteria,
    findMatching,
    handleToggleFavorite,
  } = useEntityListScreen({
    useStore: useLocationStore,
    collectionKey: 'locations',
    changeEvent: 'location_changed',
  });

  const {
    data: visibleLocations,
    outsideCount,
    expanded: showingOtherArcs,
    toggle: toggleOtherArcs,
    previewCount,
  } = useEntityArcScope({
    storyId,
    kind: 'location',
    rows: locations as LocationWithTags[],
    searchTerm: listProps.currentSearchTerm,
    findMatching,
  });

  const { canEdit } = useStoryRole(storyId);
  const memoizedTagFilterOptions = useStoryTagFilterOptions(storyId);

  const styles = useThemedStyles(createStyles);

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
      <View ref={listAnchorRef} collapsable={false} style={{ flex: 1 }}>
        <GenericFilterSortList
          {...listProps}
          onPreviewCount={previewCount}
          data={visibleLocations}
          resultsNotice={
            <OutsideArcNotice
              count={outsideCount}
              expanded={showingOtherArcs}
              onToggle={toggleOtherArcs}
            />
          }
          renderItem={memoizedRenderItem}
          keyExtractor={(item) => item.id}
          searchPlaceholder={t('search_entities', { entities: term('Location', true) })}
          filterOptions={memoizedTagFilterOptions}
          sortOptions={memoizedSortOptions}
          entityName="Location"
          storyId={storyId || ''}
          onAdvancedSearch={setStoreAdvancedSearchCriteria}
          currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
          emptyStateTitle={t('locations_empty_title')}
          emptyStateMessage={t('locations_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('locations_empty_create'),
                    onPress: () => navigation.navigate('LocationForm', { locationId: undefined }),
                    testID: 'empty-create-location',
                  },
                ]
              : []
          }
        />
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({ ...commonScreenStyleDefs(colors) });

export default LocationsScreen;
