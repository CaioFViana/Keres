import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useWorldRuleStore } from '@/src/state/worldRuleStore';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import WorldRuleListItem from '@/src/components/features/list-items/WorldRuleListItem'; // Will create this later
import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema';
import type { WorldRuleWithTags } from '../../db/schemas/worldRules';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  MainSystemDrawerParamList,
  WorldRulesStackParamList,
} from '../../navigation/MainSystemStack'; // Will create/update this later
import { createTagService } from '../../services/storymanagement/TagService'; // Import createTagService
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

export type WorldRulesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'WorldRulesStack'>,
  NativeStackNavigationProp<WorldRulesStackParamList, 'WorldRuleDetail'>
>;

const WorldRulesScreen = () => {
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();

  const drizzleDb = useDrizzle();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();
  const route = useRoute();
  const section = (route.params as { section?: WorldPieceSection } | undefined)?.section;
  useBackButtonHandler({
    showWebBackButton: true,
    onBack: () => navigation.navigate('WorldIndex'),
  });

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const {
    listProps,
    items: worldRules,
    isInitialLoading,
    error,
    storyId,
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

  useScreenHeader({
    target: 'parent',
    title: section ? t(`world_piece_section_${section}`) : term('WorldRule', true),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('WorldRuleForm', { worldRuleId: undefined }),
        visible: !!canEdit,
      },
    ],
  });

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

  if (isInitialLoading) {
    return (
      <ScreenLoading
        message={t('vocabulary_loading_entities', { entities: term('WorldRule', true) })}
      />
    );
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScreenContainer>
      <GenericFilterSortList
        {...listProps}
        data={
          section
            ? worldRules.filter((piece: WorldRuleWithTags) => piece.section === section)
            : worldRules
        }
        renderItem={memoizedWorldRuleListItem}
        keyExtractor={(item) => item.id}
        searchPlaceholder={t('vocabulary_search_entities', { entities: term('WorldRule', true) })}
        filterOptions={memoizedTagFilterOptions}
        sortOptions={memoizedSortOptions}
        disableTagFilter={false}
        entityName="WorldRule"
        storyId={storyId || ''}
      />
    </ScreenContainer>
  );
};

export default WorldRulesScreen;
