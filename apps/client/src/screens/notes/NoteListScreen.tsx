import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import NoteListItem from '../../components/listitem/NoteListItem';
import { useDrizzle } from '../../db';
import { NoteSelect } from '../../db/schemas/notes';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { MainSystemDrawerParamList, NotesStackParamList } from '../../navigation/MainSystemStack';
import { FavoriteFilterState } from '../../services/NoteService'; // Will create this later
import { useStoryStore } from '../../state/storyStore';
import { useNoteStore } from '../../state/noteStore'; // Will create this later
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type NotesScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'NotesStack'>,
  NativeStackNavigationProp<NotesStackParamList, 'NoteDetail'>
>;

const NotesScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<NotesScreenNavigationProp>();

  const {
    notes,
    searchTerm,
    activeSort,
    sortDirection,
    favoriteFilterState,
    advancedSearchCriteria,
    loading,
    error,
    fetchNotes,
    setSearchTerm,
    setDbAndStoryId,
    initializeService,
    setSort,
    setFavoriteFilter,
    setAdvancedSearchCriteria,
    toggleFavorite,
  } = useNoteStore();

  // Debounce the fetchNotes call
  const debouncedFetchNotes = useMemo(
    () => debounce(() => fetchNotes()),
    [fetchNotes]
  );

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService]);

  useEffect(() => {
    debouncedFetchNotes();
    return () => {
      debouncedFetchNotes.cancel && debouncedFetchNotes.cancel();
    };
  }, [searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria, debouncedFetchNotes]);

  useEffect(() => {
    const handleNoteChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        debouncedFetchNotes();
      }
    };

    entityEventEmitter.on('note_changed', handleNoteChange);

    return () => {
      entityEventEmitter.off('note_changed', handleNoteChange);
    };
  }, [selectedStory?.id, debouncedFetchNotes]);

  // Listen for reset event
  useEffect(() => {
    const handleReset = () => {
      // Only pop to top if there's more than one screen in the stack
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };

    entityEventEmitter.on('note_navigation_reset', handleReset);

    return () => {
      entityEventEmitter.off('note_navigation_reset', handleReset);
    };
  }, [navigation]);

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

  const memoizedNoteListItem = useCallback(({ item }: { item: NoteSelect }) => (
    <NoteListItem note={item} onViewDetails={handleViewDetails} onToggleFavorite={handleToggleFavorite} />
  ), [handleViewDetails, handleToggleFavorite]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_title'), value: 'title' }, // Changed from name to title for notes
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
        <Text style={styles.detailText}>{t('loading_notes')}</Text>
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
        data={notes}
        renderItem={memoizedNoteListItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_notes')}
        currentSearchTerm={searchTerm}
        filterOptions={[]}
        onFilterChange={() => {}}
        selectedFilterValues={[]}
        sortOptions={memoizedSortOptions}
        onSortChange={handleSortChange}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
        currentSortValue={activeSort}
        onFavoriteFilterChange={handleFavoriteFilterChange}
        currentFavoriteFilterState={favoriteFilterState}
        disableTagFilter={true}
        entityName="Note"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={advancedSearchCriteria}
      />
    </View>
  );
};

export default NotesScreen;
