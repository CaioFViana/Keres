import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import NoteListItem from '../../components/listitem/NoteListItem';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityListScreen } from '../../hooks/useEntityListScreen';
import { MainSystemDrawerParamList, NotesStackParamList } from '../../navigation/MainSystemStack';
import { NoteWithTags } from '../../services/storymanagement/NoteService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useNoteStore } from '../../state/noteStore';
import { useTheme } from '../../theme';

export type NotesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NotesStack'>,
  NativeStackNavigationProp<NotesStackParamList, 'NoteDetail'>
>;

const NotesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<NotesScreenNavigationProp>();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  const {
    items: notes,
    loading,
    error,
    storyId,
    searchQuery,
    activeFilterTags,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    handleSearch,
    handleSortChange,
    handleSortDirectionChange,
    handleFilterTagsChange,
    handleFavoriteFilterChange,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useEntityListScreen({
    useStore: useNoteStore,
    collectionKey: 'notes',
    changeEvent: 'note_changed',
  });

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

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('notes_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('NoteForm', { noteId: undefined })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleToggleFavorite = useCallback(async (noteId: string, isFavorite: boolean) => {
    await toggleFavorite(noteId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((noteId: string) => {
    navigation.navigate('NoteDetail', { noteId });
  }, [navigation]);

  const memoizedNoteListItem = useCallback(({ item }: { item: NoteWithTags }) => (
    <NoteListItem note={item} onViewDetails={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  if (loading) {
    return <ScreenLoading message={t('loading_notes')} />;
  }

  if (error) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={notes}
        renderItem={memoizedNoteListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_notes')}
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
        entityName="Note"
        storyId={storyId || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
    </View>
  );
};

export default NotesScreen;