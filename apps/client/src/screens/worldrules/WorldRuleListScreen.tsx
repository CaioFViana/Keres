import { useWorldRuleStore } from '@/src/state/worldRuleStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import WorldRuleListItem from '@/src/components/features/list-items/WorldRuleListItem'; // Will create this later
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { WorldRuleWithTags } from '../../db/schemas/worldRules';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import {
  MainSystemDrawerParamList,
  WorldRulesStackParamList,
} from '../../navigation/MainSystemStack'; // Will create/update this later
import { createTagService } from '../../services/storymanagement/TagService'; // Import createTagService
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type WorldRulesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'WorldRulesStack'>,
  NativeStackNavigationProp<WorldRulesStackParamList, 'WorldRuleDetail'>
>;

const WorldRulesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const {
    items: worldRules,
    loading,
    isInitialLoading,
    error,
    storyId,
    searchQuery,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    handleSearch,
    handleSearchSubmit,
    handleSortChange,
    handleSortDirectionChange,
    handleFilterTagsChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useWorldRuleStore,
    collectionKey: 'worldRules',
    changeEvent: 'worldrule_changed',
  });

  const { canEdit } = useStoryRole(storyId);

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
      setDocumentTitle(t('world_rules_title'));
      navigation.getParent()?.setOptions({
        title: t('world_rules_title'),
        headerRight: canEdit
          ? () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('WorldRuleForm', { worldRuleId: undefined })}
                style={{ marginRight: 15 }}
              >
                <Ionicons name="add" size={30} color={colors.text} />
              </TouchableOpacity>
            )
          : undefined,
      });
    }, [navigation, colors.text, t, canEdit]),
  );

  const handleToggleFavorite = useCallback(
    async (worldRuleId: string, isFavorite: boolean) => {
      await toggleFavorite(worldRuleId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (worldRuleId: string) => {
      navigation.navigate('WorldRuleDetail', { worldRuleId });
    },
    [navigation],
  );

  const memoizedWorldRuleListItem = useCallback(
    ({ item }: { item: WorldRuleWithTags }) => (
      <WorldRuleListItem
        worldRule={item}
        onViewDetails={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [handleViewDetails, handleToggleFavorite],
  );

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id, color: tag.color }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_title'), value: 'title' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  if (isInitialLoading) {
    return <ScreenLoading message={t('loading_world_rules')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={worldRules}
        renderItem={memoizedWorldRuleListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder={t('search_world_rules')}
        currentSearchTerm={searchQuery} // Display local state for responsive input
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
        disableTagFilter={false}
        entityName="WorldRule"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
        isLoading={loading}
      />
    </View>
  );
};

export default WorldRulesScreen;
