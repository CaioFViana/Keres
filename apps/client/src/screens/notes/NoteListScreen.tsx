import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteListItem from '@/src/components/features/list-items/NoteListItem';
import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import type {
  MainSystemDrawerParamList,
  NotesStackParamList,
} from '../../navigation/MainSystemStack';
import type { NoteWithTags } from '../../services/storymanagement/NoteService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useNoteStore } from '../../state/noteStore';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type NotesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NotesStack'>,
  NativeStackNavigationProp<NotesStackParamList, 'NoteDetail'>
>;

const NotesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();

  const drizzleDb = useDrizzle();
  const navigation = useNavigation<NotesScreenNavigationProp>();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const {
    listProps,
    items: notes,
    isInitialLoading,
    error,
    storyId,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useNoteStore,
    collectionKey: 'notes',
    changeEvent: 'note_changed',
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
    title: t('notes_title'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('add'),
        onPress: () => navigation.navigate('NoteForm', { noteId: undefined }),
        visible: !!canEdit,
      },
    ],
  });

  const handleToggleFavorite = useCallback(
    async (noteId: string, isFavorite: boolean) => {
      await toggleFavorite(noteId, isFavorite);
    },
    [toggleFavorite],
  );

  const handleViewDetails = useCallback(
    (noteId: string) => {
      navigation.navigate('NoteDetail', { noteId });
    },
    [navigation],
  );

  const memoizedNoteListItem = useCallback(
    ({ item }: { item: NoteWithTags }) => (
      <NoteListItem
        note={item}
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
    return <ScreenLoading message={t('loading_notes')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScreenContainer>
      <GenericFilterSortList
        {...listProps}
        data={notes}
        renderItem={memoizedNoteListItem}
        keyExtractor={(item) => item.id}
        searchPlaceholder={t('search_notes')}
        filterOptions={memoizedTagFilterOptions}
        sortOptions={memoizedSortOptions}
        disableTagFilter={false}
        entityName="Note"
        storyId={storyId || ''}
      />
    </ScreenContainer>
  );
};

export default NotesScreen;
