import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ChapterReorderModal from '../../components/ChapterReorderModal/ChapterReorderModal'; // Import the modal
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import ChapterListItem from '../../components/listitem/ChapterListItem';
import { useDrizzle } from '../../db';
import { ChapterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ChapterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { FavoriteFilterState } from '../../services/storymanagement/ChapterService';
import { useChapterStore } from '../../state/chapterStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ChaptersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ChaptersStack'>,
  NativeStackNavigationProp<ChapterStackParamList, 'ChapterDetail'>
>;

const ChapterListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<ChaptersScreenNavigationProp>();

  const {
    chapters,
    searchTerm: storeSearchTerm,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    loading,
    error,
    fetchChapters,
    setSearchTerm: setStoreSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
    reorderChapters,
  } = useChapterStore();

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
    fetchChapters();
  }, [storeSearchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, fetchChapters]);

  useEffect(() => {
    const handleChapterChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchChapters();
      }
    };

    entityEventEmitter.on('chapter_changed', handleChapterChange);

    return () => {
      entityEventEmitter.off('chapter_changed', handleChapterChange);
    };
  }, [selectedStory?.id, fetchChapters]);

  const handleToggleFavorite = useCallback(async (chapterId: string, isFavorite: boolean) => {
    await toggleFavorite(chapterId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((chapterId: string) => {
    navigation.navigate('ChapterDetail', { chapterId });
  }, [navigation]);

  const memoizedChapterListItem = useCallback(({ item }: { item: ChapterSelect }) => (
    <ChapterListItem chapter={item} onViewDetails={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
  ), [handleViewDetails, handleToggleFavorite]);

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

  const handleReorderConfirm = useCallback(async (newOrder: { id: string, newIndex: number }[]) => {
    await reorderChapters(newOrder);
    setIsReorderModalVisible(false);
  }, [reorderChapters]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('chapters_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              onPress={handleReorderPress}
              style={styles.headerButton}
            >
              <Ionicons name="swap-vertical" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChapterForm', { chapterId: undefined })}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={30} color={colors.text} />
            </TouchableOpacity>
          </View>
        ),
      });
    }, [navigation, colors.text, t, handleReorderPress])
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
        <Text style={styles.detailText}>{t('loading_chapters')}</Text>
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
        data={chapters}
        renderItem={memoizedChapterListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_chapters')}
        currentSearchTerm={searchQuery}
        filterOptions={[]} // Chapters don't have tags themselves
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
        entityName="Chapter"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
      <ChapterReorderModal
        isVisible={isReorderModalVisible}
        onClose={() => setIsReorderModalVisible(false)}
        chapters={chapters}
        onReorderConfirm={handleReorderConfirm}
      />
    </View>
  );
};

export default ChapterListScreen;
