import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TagListItem from '../../components/listitem/TagListItem';
import { TagSelect } from '../../db/schemas/tags';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { MainSystemDrawerParamList, TagsStackParamList } from '../../navigation/MainSystemStack';
import { useTagStore } from '../../state/tagStore';
import { useTheme } from '../../theme';

export type TagsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'TagsStack'>, // Corrected to TagsStack
  NativeStackNavigationProp<TagsStackParamList, 'TagDetail'> // Assuming TagDetail exists in TagsStackParamList
>;

const TagsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<TagsScreenNavigationProp>();

  const {
    items: tags,
    loading,
    error,
    storyId,
    searchQuery,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    handleSearch,
    handleSortChange,
    handleSortDirectionChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useTagStore,
    collectionKey: 'tags',
    changeEvent: 'tag_changed',
  });

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('tags_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('TagForm', { tagId: undefined })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleToggleFavorite = useCallback(async (tagId: string, isFavorite: boolean) => {
    await toggleFavorite(tagId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((tagId: string) => {
    navigation.navigate('TagDetail', { tagId });
  }, [navigation]);

  const memoizedTagListItem = useCallback(({ item }: { item: TagSelect }) => (
    <TagListItem tag={item} onViewDetails={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
  ), [handleViewDetails, handleToggleFavorite]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' }
    ];
  }, [t]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  if (loading) {
    return <ScreenLoading message={t('loading_tags')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={tags}
        renderItem={memoizedTagListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_tags')}
        currentSearchTerm={searchQuery} // Display local state for responsive input
        filterOptions={[]} // No tag filtering by other tags for TagsScreen
        onFilterChange={() => {}} // No tag filtering by other tags for TagsScreen
        selectedFilterValues={[]} // No tag filtering by other tags for TagsScreen
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        disableTagFilter={true} // Disable the tag filter select since there are no filter options
        entityName="Tag"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria} // Pass the setter
        currentAdvancedSearchCriteria={advancedSearchCriteria} // Pass the criteria
      />
    </View>
  );
};

export default TagsScreen;
