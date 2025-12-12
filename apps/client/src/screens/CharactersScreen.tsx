import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CharacterListItem from '../components/character/CharacterListItem';
import GenericFilterSortList from '../components/common/GenericFilterSortList/GenericFilterSortList';
import { useDrizzle } from '../db';
import { TagSelect } from '../db/schema';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import { CharacterWithTags, FavoriteFilterState } from '../services/CharacterService'; // Import CharacterWithTags and FavoriteFilterState
import { createTagService } from '../services/TagService';
import { useCharacterStore } from '../state/characterStore';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';
import { debounce } from '../utils/debounce'; // Import debounce
import { entityEventEmitter } from '../utils/EventEmitter';

export type CharactersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharactersStack'>,
  NativeStackNavigationProp<CharacterStackParamList, 'CharacterDetail'>
>;

const CharactersScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<CharactersScreenNavigationProp>();

  // Use the character store
  const {
    characters,
    searchTerm,
    activeFilterTags,
    favoriteFilterState, // Destructure favoriteFilterState
    activeSort,
    sortDirection,
    loading,
    error,
    setDbAndStoryId,
    initializeService,
    fetchCharacters,
    setSearchTerm,
    setFilterTags,
    setFavoriteFilter, // Destructure setFavoriteFilter
    setSort,
    toggleFavorite,
  } = useCharacterStore();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;

  // Styles are always defined at the top
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

  // All handlers and computed values are declared before conditional returns
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
  }, [selectedStory?.id, tagService]); // Add tagService to dependencies

  // Debounce the fetchCharacters call
  const debouncedFetchCharacters = useMemo(
    () => debounce(() => fetchCharacters()),
    [fetchCharacters]
  );

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      // fetchCharacters(); // Removed: now handled by debounced effect
      fetchTags();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService, fetchTags]);

  useEffect(() => {
    debouncedFetchCharacters();
    return () => {
      debouncedFetchCharacters.cancel && debouncedFetchCharacters.cancel();
    };
  }, [searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, debouncedFetchCharacters]); // Add favoriteFilterState

  useEffect(() => {
    const handleCharacterChange = (storyId: string) => {
      // Only refetch if the change is for the currently selected story
      if (selectedStory?.id === storyId) {
        debouncedFetchCharacters();
      }
    };

    entityEventEmitter.on('character_changed', handleCharacterChange);

    return () => {
      entityEventEmitter.off('character_changed', handleCharacterChange);
    };
  }, [selectedStory?.id, debouncedFetchCharacters]); // Dependencies for event listener

  // Listen for reset event
  useEffect(() => {
    const handleReset = () => {
      // Only pop to top if there's more than one screen in the stack
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };

    entityEventEmitter.on('character_navigation_reset', handleReset);

    return () => {
      entityEventEmitter.off('character_navigation_reset', handleReset);
    };
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: t('characters_title'),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CharacterForm', { characterId: undefined })} // Navigate to CharacterForm for creation
            style={{ marginRight: 15 }}
          >
            <Ionicons name="add" size={30} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }, [navigation, colors.text, t])
  );

  const handleToggleFavorite = useCallback(async (characterId: string, isFavorite: boolean) => {
    await toggleFavorite(characterId, isFavorite);
  }, [toggleFavorite]);

  const handleViewDetails = useCallback((characterId: string) => {
    navigation.navigate('CharacterDetail', { characterId });
  }, [navigation]);

  const memoizedRenderItem = useCallback(({ item }: { item: CharacterWithTags }) => (
    <CharacterListItem
      character={item}
      onToggleFavorite={handleToggleFavorite}
      onViewDetails={handleViewDetails}
    />
  ), [handleToggleFavorite, handleViewDetails]);

  const memoizedTagFilterOptions = useMemo(() => {
    return allTags.map(tag => ({ label: tag.name, value: tag.id }));
  }, [allTags]);

  const memoizedSortOptions = useMemo(() => {
    return [
      { label: t('sort_by_name'), value: 'name' },
      { label: t('sort_by_created_at'), value: 'createdAt' },
      { label: t('sort_by_updated_at'), value: 'updatedAt' },
    ];
  }, [t]);

  const handleSortChange = useCallback((sortBy: string | null) => {
    setSort(sortBy, sortDirection);
  }, [setSort, sortDirection]);

  const handleSortDirectionChange = useCallback((direction: 'asc' | 'desc') => {
    setSort(activeSort, direction);
  }, [setSort, activeSort]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, [setSearchTerm]);

  const handleFilterChange = useCallback((selectedValues: string[]) => {
    setFilterTags(selectedValues);
  }, [setFilterTags]);

  const handleFavoriteFilterChange = useCallback((state: FavoriteFilterState) => {
    setFavoriteFilter(state);
  }, [setFavoriteFilter]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>Loading characters...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title="Go Back" onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={characters} // Use characters from store
        renderItem={memoizedRenderItem} // Use memoized renderItem
        keyExtractor={(item) => item.id}
        onSearch={handleSearch} // Use store action
        searchPlaceholder={t('search_characters')}
        currentSearchTerm={searchTerm} // Pass searchTerm from store
        filterOptions={memoizedTagFilterOptions} // Use memoized filterOptions
        onFilterChange={handleFilterChange} // Use store action
        selectedFilterValues={activeFilterTags} // Use store state
        sortOptions={memoizedSortOptions} // Use memoized sortOptions
        onSortChange={handleSortChange} // Use store action
        onSortDirectionChange={handleSortDirectionChange} // Use store action
        currentSortDirection={sortDirection} // Use store state
        currentSortValue={activeSort} // Pass activeSort from store
        onFavoriteFilterChange={handleFavoriteFilterChange} // Pass handler for favorite filter
        currentFavoriteFilterState={favoriteFilterState} // Pass current favorite filter state
      />
    </View>
  );
};

export default CharactersScreen;
