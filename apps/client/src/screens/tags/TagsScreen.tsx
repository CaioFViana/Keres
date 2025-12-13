import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import TagListItem from '../../components/listitem/TagListItem';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schemas/tags';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList, TagsStackParamList } from '../../navigation/MainSystemStack';
import { FavoriteFilterState } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useTagStore } from '../../state/tagStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type TagsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'TagsStack'>, // Corrected to TagsStack
  NativeStackNavigationProp<TagsStackParamList, 'TagDetail'> // Assuming TagDetail exists in TagsStackParamList
>;

const TagsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<TagsScreenNavigationProp>();

  const {
    tags,
    searchTerm,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria, // Destructure advancedSearchCriteria
    loading,
    error,
    fetchTags,
    setSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFavoriteFilter,
    setAdvancedSearchCriteria, // Destructure setAdvancedSearchCriteria
    toggleFavorite,
  } = useTagStore();

  // Debounce the fetchTags call
  const debouncedFetchTags = useMemo(
    () => debounce(() => fetchTags()),
    [fetchTags]
  );

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService]);

  useEffect(() => {
    debouncedFetchTags();
    return () => {
      debouncedFetchTags.cancel && debouncedFetchTags.cancel();
    };
  }, [searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, debouncedFetchTags]);

  useEffect(() => {
    const handleTagChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        debouncedFetchTags();
      }
    };

    entityEventEmitter.on('tag_changed', handleTagChange);

    return () => {
      entityEventEmitter.off('tag_changed', handleTagChange);
    };
  }, [selectedStory?.id, debouncedFetchTags]);

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

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, [setSearchTerm]);

  const handleSortChange = useCallback((sortBy: string | null) => {
    setSort(sortBy, sortDirection);
  }, [setSort, sortDirection]);

  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setSort(activeSort, direction);
  }, [setSort, activeSort]);

  const handleFavoriteFilterChange = useCallback((state: FavoriteFilterState) => {
    setFavoriteFilter(state);
  }, [setFavoriteFilter]);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_tags')}</Text>
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
        data={tags}
        renderItem={memoizedTagListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_tags')}
        currentSearchTerm={searchTerm}
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
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria} // Pass the setter
        currentAdvancedSearchCriteria={advancedSearchCriteria} // Pass the criteria
      />
    </View>
  );
};

export default TagsScreen;
