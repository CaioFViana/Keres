import ScreenContainer from '@/src/components/layout/ScreenContainer/ScreenContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import GenericFilterSortList from '@/src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteListItem from '@/src/components/features/list-items/NoteListItem';
import { useScreenAnchor } from '../../guides/useGuideAnchor';
import { useScreenTour } from '../../guides/useScreenTour';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryTagFilterOptions } from '../../hooks/useStoryTagFilterOptions';
import { useTitleDateSortOptions } from '../../hooks/useTitleDateSortOptions';
import type {
  MainSystemDrawerParamList,
  NotesStackParamList,
} from '../../navigation/MainSystemStack';
import type { NoteWithTags } from '../../services/storymanagement/NoteService';
import { useNoteStore } from '../../state/noteStore';

export type NotesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NotesStack'>,
  NativeStackNavigationProp<NotesStackParamList, 'NoteDetail'>
>;

const NotesScreen = () => {
  useBackButtonHandler();
  useScreenTour('NotesStack');
  const listAnchorRef = useScreenAnchor('Notes', 'list');
  const { t } = useTranslation();

  const navigation = useNavigation<NotesScreenNavigationProp>();

  const {
    listProps,
    items: notes,
    isInitialLoading,
    error,
    storyId,
    handleToggleFavorite,
  } = useEntityListScreen({
    useStore: useNoteStore,
    collectionKey: 'notes',
    changeEvent: 'note_changed',
  });

  const { canEdit } = useStoryRole(storyId);
  const memoizedTagFilterOptions = useStoryTagFilterOptions(storyId);

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

  const memoizedSortOptions = useTitleDateSortOptions();

  if (isInitialLoading) {
    return <ScreenLoading message={t('loading_notes')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScreenContainer>
      <View ref={listAnchorRef} collapsable={false} style={{ flex: 1 }}>
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
          emptyStateTitle={t('notes_empty_title')}
          emptyStateMessage={t('notes_empty_message')}
          emptyStateActions={
            canEdit
              ? [
                  {
                    label: t('notes_empty_create'),
                    onPress: () => navigation.navigate('NoteForm', { noteId: undefined }),
                    testID: 'empty-create-note',
                  },
                ]
              : []
          }
        />
      </View>
    </ScreenContainer>
  );
};

export default NotesScreen;
