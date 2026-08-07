import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import ChapterReorderModal from '../../components/ChapterReorderModal/ChapterReorderModal'; // Import the modal
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import ChapterListItem from '../../components/listitem/ChapterListItem';
import { ChapterSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { ChapterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { useChapterStore } from '../../state/chapterStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';

export type ChaptersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'ChaptersStack'>,
  NativeStackNavigationProp<ChapterStackParamList, 'ChapterDetail'>
>;

const ChapterListScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ChaptersScreenNavigationProp>();

  const {
    items: chapters,
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
    useStore: useChapterStore,
    collectionKey: 'chapters',
    changeEvent: 'chapter_changed',
  });

  const { canEdit } = useStoryRole(storyId);

  // Reordering isn't part of the shared list wiring, so it comes straight from the store.
  const reorderChapters = useChapterStore((state) => state.reorderChapters);

  const [isReorderModalVisible, setIsReorderModalVisible] = useState(false);

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

  const handleReorderPress = useCallback(() => {
    setIsReorderModalVisible(true);
  }, []);

  const handleReorderConfirm = useCallback(async (newOrder: { id: string, newIndex: number }[]) => {
    await reorderChapters(newOrder);
    setIsReorderModalVisible(false);
  }, [reorderChapters]);

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
      setDocumentTitle(t('chapters_title'));
      navigation.getParent()?.setOptions({
        title: t('chapters_title'),
        headerRight: () => (
          <View style={styles.headerRightContainer}>
            {canEdit && (
              <TouchableOpacity
                onPress={handleReorderPress}
                style={styles.headerButton}
              >
                <Ionicons name="swap-vertical" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ChapterForm', { chapterId: undefined })}
                style={styles.headerButton}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        ),
      });
    }, [navigation, colors.text, t, handleReorderPress, styles.headerButton, styles.headerRightContainer, canEdit])
  );

  if (loading && chapters.length === 0) {
    return <ScreenLoading message={t('loading_chapters')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={chapters}
        renderItem={memoizedChapterListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
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
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
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
