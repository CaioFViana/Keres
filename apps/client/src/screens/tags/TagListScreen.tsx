import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import TagListItem from '@/src/components/features/list-items/TagListItem';
import type { TagSelect } from '../../db/schemas/tags';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import type {
  MainSystemDrawerParamList,
  TagsStackParamList,
} from '../../navigation/MainSystemStack';
import { useTagStore } from '../../state/tagStore';

export type TagsScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'TagsStack'>, // Corrected to TagsStack
  NativeStackNavigationProp<TagsStackParamList, 'TagDetail'> // Assuming TagDetail exists in TagsStackParamList
>;

const TagsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();

  const navigation = useNavigation<TagsScreenNavigationProp>();

  const {
    listProps,
    items: tags,
    isInitialLoading,
    error,
    storyId,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useTagStore,
    collectionKey: 'tags',
    changeEvent: 'tag_changed',
  });

  useScreenHeader({
    target: 'parent',
    title: t('tags_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('TagForm', { tagId: undefined }),
      },
    ],
  });

  const handleToggleFavorite = useCallback(
    async (tagId: string, isFavorite: boolean) => {
      await toggleFavorite(tagId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (tagId: string) => {
      navigation.navigate('TagDetail', { tagId });
    },
    [navigation],
  );

  const memoizedTagListItem = useCallback(
    ({ item }: { item: TagSelect }) => (
      <TagListItem
        tag={item}
        onViewDetails={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [handleViewDetails, handleToggleFavorite],
  );

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  if (isInitialLoading) {
    return <ScreenLoading message={t('loading_tags')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScreenContainer>
      <GenericFilterSortList
        {...listProps}
        data={tags}
        renderItem={memoizedTagListItem}
        keyExtractor={(item) => item.id}
        searchPlaceholder={t('search_tags')}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        disableTagFilter={true}
        entityName="Tag"
        storyId={storyId || ''}
      />
    </ScreenContainer>
  );
};

export default TagsScreen;
