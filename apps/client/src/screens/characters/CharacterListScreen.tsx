import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, StackActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GenericFilterSortList from '../../components/common/GenericFilterSortList/GenericFilterSortList';
import CharacterListItem from '../../components/listitem/CharacterListItem';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { CharacterWithTags, FavoriteFilterState } from '../../services/CharacterService';
import { createTagService } from '../../services/TagService';
import { useCharacterStore } from '../../state/characterStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { debounce } from '../../utils/debounce';
import { entityEventEmitter } from '../../utils/EventEmitter';

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
    searchTerm: storeSearchTerm, // Renamed to avoid collision with local state
    activeFilterTags,
    favoriteFilterState,
    activeSort,
    sortDirection,
    loading,
    error,
    setDbAndStoryId,
    initializeService,
    fetchCharacters,
    setSearchTerm: setStoreSearchTerm, // Renamed to avoid collision with local state
    setFilterTags,
    setFavoriteFilter,
    setSort,
    toggleFavorite,
    advancedSearchCriteria: storeAdvancedSearchCriteria,
    setAdvancedSearchCriteria: setStoreAdvancedSearchCriteria,
  } = useCharacterStore();

  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const tagService = useRef(createTagService(drizzleDb)).current;
  const [searchQuery, setSearchQuery] = useState(storeSearchTerm); // Local state for immediate input feedback

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
  }, [selectedStory?.id, tagService]);

  // Debounce the update to the store's searchTerm
  useEffect(() => {
    const handler = debounce(() => {
      setStoreSearchTerm(searchQuery);
    }, 1000); // Debounce for 1000ms

    handler();

    return () => {
      handler.cancel && handler.cancel();
    };
  }, [searchQuery, setStoreSearchTerm]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setDbAndStoryId(drizzleDb, selectedStory.id);
      initializeService();
      fetchTags();
    }
  }, [drizzleDb, selectedStory?.id, setDbAndStoryId, initializeService, fetchTags]);

  // Effect to trigger fetch when storeSearchTerm changes (after debounce)
  // or when other filter/sort criteria change (immediately via store setters)
  useEffect(() => {
    fetchCharacters();
  }, [storeSearchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, storeAdvancedSearchCriteria, fetchCharacters]);

  useEffect(() => {
    const handleCharacterChange = (storyId: string) => {
      if (selectedStory?.id === storyId) {
        fetchCharacters(); // Call the immediate fetchCharacters
      }
    };

    entityEventEmitter.on('character_changed', handleCharacterChange);

    return () => {
      entityEventEmitter.off('character_changed', handleCharacterChange);
    };
  }, [selectedStory?.id, fetchCharacters]);

  // Listen for reset event
  useEffect(() => {
    const handleReset = () => {
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
            onPress={() => navigation.navigate('CharacterForm', { characterId: undefined })}
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
    return allTags.map((tag: TagSelect) => ({ label: tag.name, value: tag.id }));
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
    setSearchQuery(term); // Update local state immediately
  }, [setSearchQuery]);

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
        <Text style={styles.detailText}>{t('loading_characters')}</Text>
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
        data={characters}
        renderItem={memoizedRenderItem}
        keyExtractor={(item) => item.id}
        onSearch={handleSearch}
        searchPlaceholder={t('search_characters')}
        currentSearchTerm={searchQuery} // Display local state for responsive input
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
        entityName="Character"
        storyId={selectedStory?.id || ''}
        onAdvancedSearch={setStoreAdvancedSearchCriteria}
        currentAdvancedSearchCriteria={storeAdvancedSearchCriteria}
      />
    </View>
  );
};

export default CharactersScreen;