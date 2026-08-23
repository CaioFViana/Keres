import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import SceneListItem from '@/src/components/features/list-items/SceneListItem';
import SceneReorderModal from '@/src/components/features/scenes/SceneReorderModal/SceneReorderModal'; // Import the modal
import { SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useOpenStoryTimelineViewer } from '../../hooks/useOpenStoryTimelineViewer';
import { MainSystemDrawerParamList, SceneStackParamList } from '../../navigation/MainSystemStack';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

export type ScenesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ScenesStack'>,
  NativeStackNavigationProp<SceneStackParamList, 'SceneDetail'>
>;

const SceneListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const navigation = useNavigation<ScenesScreenNavigationProp>();
  const openStoryTimeline = useOpenStoryTimelineViewer();

  const {
    items: scenes,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useSceneStore,
    collectionKey: 'scenes',
    changeEvent: 'scene_changed',
  });

  const { canEdit } = useStoryRole(storyId);

  // Reordering isn't part of the shared list wiring, so it comes straight from the store.
  const reorderScenes = useSceneStore((state) => state.reorderScenes);

  const [isReorderModalVisible, setIsReorderModalVisible] = useState(false);

  const handleToggleFavorite = useCallback(
    async (sceneId: string, isFavorite: boolean) => {
      await toggleFavorite(sceneId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (sceneId: string) => {
      navigation.navigate('SceneDetail', { sceneId });
    },
    [navigation],
  );

  const memoizedSceneListItem = useCallback(
    ({ item }: { item: SceneSelect }) => (
      <SceneListItem
        scene={item}
        storyType={selectedStory?.type}
        onViewDetails={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [handleViewDetails, handleToggleFavorite, selectedStory?.type],
  );

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_index'), value: 'index' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  const handleReorderPress = useCallback(() => {
    setIsReorderModalVisible(true);
  }, []);

  const handleReorderConfirm = useCallback(
    async (chapterId: string, newOrder: { id: string; newIndex: number }[]) => {
      await reorderScenes(chapterId, newOrder);
      setIsReorderModalVisible(false);
    },
    [reorderScenes],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRightContainer: {
      flexDirection: 'row',
      marginRight: 15,
    },
    headerButton: {
      marginLeft: 15,
    },
  });

  useFocusEffect(
    useCallback(() => {
      setDocumentTitle(t('scenes_title'));
      navigation.getParent()?.setOptions({
        title: t('scenes_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {selectedStory?.type === 'linear' && (
              <TouchableOpacity onPress={openStoryTimeline} style={styles.headerButton}>
                <Ionicons name="bar-chart-outline" size={23} color={colors.text} />
              </TouchableOpacity>
            )}
            {selectedStory?.type === 'linear' && canEdit && (
              <TouchableOpacity onPress={handleReorderPress} style={styles.headerButton}>
                <Ionicons name="swap-vertical" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('SceneForm', { sceneId: undefined })}
                style={styles.headerButton}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [
      navigation,
      colors.text,
      t,
      handleReorderPress,
      openStoryTimeline,
      selectedStory?.type,
      styles.headerButton,
      styles.headerRightContainer,
      canEdit,
    ]),
  );

  if (loading && scenes.length === 0) {
    return <ScreenLoading message={t('loading_scenes')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={scenes}
        renderItem={memoizedSceneListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('search_scenes')}
        currentSearchTerm={searchQuery}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        disableTagFilter={true}
        entityName="Scene"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
      />
      <SceneReorderModal
        isVisible={isReorderModalVisible}
        onClose={() => setIsReorderModalVisible(false)}
        storyId={storyId || ''} // Pass storyId
        scenes={scenes}
        onReorderConfirm={handleReorderConfirm}
      />
    </View>
  );
};

export default SceneListScreen;
