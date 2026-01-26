import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import SceneListItem from '../../components/listitem/SceneListItem';
import SceneReorderModal from '../../components/SceneReorderModal/SceneReorderModal'; // Import the modal
import { useDrizzle } from '../../db';
import { SceneSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList, SceneStackParamList } from '../../navigation/MainSystemStack';
import { FavoriteFilterState } from '../../services/SceneService';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ScenesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ScenesStack'>,
  NativeStackNavigationProp<SceneStackParamList, 'SceneDetail'>
>;

const SceneListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ScenesScreenNavigationProp>();

  const {
    scenes,
    searchTerm: storeSearchTerm,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    loading,
    error,
    fetchScenes,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
    reorderScenes,
  } = useSceneStore();

  const [searchQuery, setSearchQuery] = useState(storeSearchTerm);
  const [isReorderModalVisible, setIsReorderModalVisible] = useState(false);

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
    fetchScenes();
  }, [storeSearchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, fetchScenes]);

  useEffect(() => {
    const handleSceneChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchScenes();
      }
    };

    entityEventEmitter.on('scene_changed', handleSceneChange);

    return () => {
      entityEventEmitter.off('scene_changed', handleSceneChange);
    };
  }, [selectedStory?.id, fetchScenes]);

  const handleToggleFavorite = useCallback(async (sceneId: string, isFavorite: boolean) => {
    await toggleFavorite(sceneId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((sceneId: string) => {
    navigation.navigate('SceneDetail', { sceneId });
  }, [navigation]);

  const memoizedSceneListItem = useCallback(({ item }: { item: SceneSelect }) => (
    <SceneListItem
      scene={item}
      storyType={selectedStory?.type}
      onViewDetails={handleViewDetails}
      onToggleFavorite={handleToggleFavorite}
    />
  ), [handleViewDetails, handleToggleFavorite, selectedStory?.type]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_index'), value: 'index' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' }
    ];
  }, [t]);

  const handleSearch = useCallback((term: string) => {
    setSearchQuery(term);
  }, [setSearchQuery]);

  const handleSortChange = useCallback((sortBy: string | null) => {
    setSort(sortBy, sortDirection);
  }, [setSort, sortDirection]);

  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setSort(activeSort, direction);
  }, [setSort, activeSort]);

  const handleFavoriteFilterChange = useCallback((state: FavoriteFilterState) => {
    setFavoriteFilter(state);
  }, [setFavoriteFilter]);

  const handleReorderPress = useCallback(() => {
    setIsReorderModalVisible(true);
  }, []);

  const handleReorderConfirm = useCallback(async (chapterId: string, newOrder: { id: string, newIndex: number }[]) => {
    await reorderScenes(chapterId, newOrder);
    setIsReorderModalVisible(false);
  }, [reorderScenes]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('scenes_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {selectedStory?.type === 'linear' && (
              <TouchableOpacity
                onPress={handleReorderPress}
                style={styles.headerButton}
              >
                <Ionicons name="swap-vertical" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('SceneForm', { sceneId: undefined })}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={30} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
      });
    }, [navigation, colors.text, t, handleReorderPress, selectedStory?.type])
  );

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
    headerRightContainer: {
      flexDirection: 'row',
      marginRight: 15,
    },
    headerButton: {
      marginLeft: 15,
    },
    buttonContainer: {
      marginTop: 20,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_scenes')}</Text>
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
        data={scenes}
        renderItem={memoizedSceneListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
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
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
      <SceneReorderModal
        isVisible={isReorderModalVisible}
        onClose={() => setIsReorderModalVisible(false)}
        storyId={selectedStory?.id || ''} // Pass storyId
        scenes={scenes}
        onReorderConfirm={handleReorderConfirm}
      />
    </View>
  );
};

export default SceneListScreen;
