import { worldRuleStore } from '@/src/state/worldRuleStore';
import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import WorldRuleListItem from '../../components/listitem/WorldRuleListItem'; // Will create this later
import { useDrizzle, WorldRuleSelect } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList, WorldRulesStackParamList } from '../../navigation/MainSystemStack'; // Will create/update this later
import { createTagService } from '../../services/TagService'; // Import createTagService
import { FavoriteFilterState } from '../../services/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type WorldRulesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'WorldRulesStack'>,
  NativeStackNavigationProp<WorldRulesStackParamList, 'WorldRuleDetail'>
>;

const WorldRulesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const {
    worldRules,
    searchTerm,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    loading,
    error,
    fetchWorldRules,
    setSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFilterTags,
    setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = worldRuleStore();

  // Debounce the fetchWorldRules call
  const debouncedFetchWorldRules = useMemo(
    () => debounce(() => fetchWorldRules()),
    [fetchWorldRules]
  );

  const fetchTags = useCallback(async () => {
    if (!selectedStory?.id) {
      setAllTags([]);
      return;
    }
    try {
      const fetchedTags = await tagService.getTagsByStoryId(selectedStory.id);
      setAllTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [selectedStory?.id, tagService]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      fetchTags();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService, fetchTags]);

  useEffect(() => {
    debouncedFetchWorldRules();
    return () => {
      debouncedFetchWorldRules.cancel && debouncedFetchWorldRules.cancel();
    };
  }, [searchTerm, activeFilterTags, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, debouncedFetchWorldRules]);

  useEffect(() => {
    const handleWorldRuleChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        debouncedFetchWorldRules();
      }
    };

    entityEventEmitter.on('worldrule_changed', handleWorldRuleChange);

    return () => {
      entityEventEmitter.off('worldrule_changed', handleWorldRuleChange);
    };
  }, [selectedStory?.id, debouncedFetchWorldRules]);

  // Listen for reset event
  useEffect(() => {
    const handleReset = () => {
      // Only pop to top if there's more than one screen in the stack
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };

    entityEventEmitter.on('worldrule_navigation_reset', handleReset);

    return () => {
      entityEventEmitter.off('worldrule_navigation_reset', handleReset);
    };
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('world_rules_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('WorldRuleForm', { worldRuleId: undefined })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleToggleFavorite = useCallback(async (worldRuleId: string, isFavorite: boolean) => {
    await toggleFavorite(worldRuleId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((worldRuleId: string) => {
    navigation.navigate('WorldRuleDetail', { worldRuleId });
  }, [navigation]);

  const memoizedWorldRuleListItem = useCallback(({ item }: { item: WorldRuleSelect }) => (
    <WorldRuleListItem worldRule={item} onViewDetails={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
  ), [handleViewDetails, handleToggleFavorite]);

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_title'), value: 'title' },
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

  const handleFilterChange = useCallback((selectedValues: string[]) => {
    setFilterTags(selectedValues);
  }, [setFilterTags]);

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
        <Text style={styles.detailText}>{t('loading_world_rules')}</Text>
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
        data={worldRules}
        renderItem={memoizedWorldRuleListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_world_rules')}
        currentSearchTerm={searchTerm}
        filterOptions={memoizedTagFilterOptions}
        onFilterChange={handleFilterChange}
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
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
    </View>
  );
};

export default WorldRulesScreen;