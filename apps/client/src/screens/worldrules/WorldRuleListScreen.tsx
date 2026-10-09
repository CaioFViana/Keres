import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useWorldRuleStore } from '@/src/state/worldRuleStore';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import WorldRuleListItem from '@/src/components/features/list-items/WorldRuleListItem'; // Will create this later
import type { WorldRuleWithTags } from '../../db/schemas/worldRules';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryTagFilterOptions } from '../../hooks/useStoryTagFilterOptions';
import type {
  MainSystemDrawerParamList,
  WorldRulesStackParamList,
} from '../../navigation/MainSystemStack'; // Will create/update this later
import { useStoryVocabulary } from '../../vocabulary/useStoryVocabulary';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

export type WorldRulesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'WorldRulesStack'>,
  NativeStackNavigationProp<WorldRulesStackParamList, 'WorldRuleDetail'>
>;

const WorldRulesScreen = () => {
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();

  const navigation = useNavigation<WorldRulesScreenNavigationProp>();
  const route = useRoute();
  const section = (route.params as { section?: WorldPieceSection } | undefined)?.section;
  useBackButtonHandler({ showWebBackButton: true });

  const {
    listProps,
    items: worldRules,
    isInitialLoading,
    error,
    storyId,
    handleToggleFavorite,
  } = useEntityListScreen({
    useStore: useWorldRuleStore,
    collectionKey: 'worldRules',
    changeEvent: 'worldrule_changed',
  });

  const { canEdit } = useStoryRole(storyId);
  const memoizedTagFilterOptions = useStoryTagFilterOptions(storyId);

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
        emptyStateTitle={t('worldrules_empty_title')}
        emptyStateMessage={t('worldrules_empty_message')}
        emptyStateActions={
          canEdit
            ? [
                {
                  label: t('worldrules_empty_create'),
                  onPress: () => navigation.navigate('WorldRuleForm', { worldRuleId: undefined }),
                  testID: 'empty-create-worldrule',
                },
              ]
            : []
        }
      />
    </ScreenContainer>
  );
};

export default WorldRulesScreen;
