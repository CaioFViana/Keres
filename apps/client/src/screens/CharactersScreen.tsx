import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import CharacterListItem from '../components/character/CharacterListItem';
import GenericFilterSortList from '../components/common/GenericFilterSortList/GenericFilterSortList';
import { useDrizzle } from '../db';
import { TagSelect } from '../db/schema';
import { CharacterWithTags, createCharacterService } from '../services/CharacterService';
import { createTagService } from '../services/TagService';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';


const CharactersScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();

  const [characters, setCharacters] = useState<CharacterWithTags[]>([]); // Use CharacterWithTags
  const [filteredCharacters, setFilteredCharacters] = useState<CharacterWithTags[]>([]); // Use CharacterWithTags
  const [allTags, setAllTags] = useState<TagSelect[]>([]);
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([]); // Changed to array for multiple tags
  const [activeSort, setActiveSort] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const characterService = useRef(createCharacterService(drizzleDb)).current;
  const tagService = useRef(createTagService(drizzleDb)).current;

  const fetchCharacters = useCallback(async () => {
    if (!selectedStory?.id) {
      setCharacters([]);
      setFilteredCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterService.getCharactersByStoryId(
        selectedStory.id,
        activeSearch,
        activeFilterTags.length > 0 ? activeFilterTags : undefined, // Pass array of tag IDs
        activeSort || undefined, // Pass activeSort
        sortDirection // Pass sortDirection
      );
      setCharacters(fetchedCharacters);
      setFilteredCharacters(fetchedCharacters); // Set filtered characters directly from service result
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    }
  }, [selectedStory?.id, activeSearch, activeFilterTags, activeSort, sortDirection]); // Dependencies updated

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
  }, [selectedStory?.id]);

  useEffect(() => {
    fetchCharacters();
    fetchTags();
  }, [fetchCharacters, fetchTags]);

  const handleToggleFavorite = useCallback(async (characterId: string, isFavorite: boolean) => {
    try {
      await characterService.updateCharacter(characterId, { isFavorite });
      // After updating, re-fetch the characters to update the list
      fetchCharacters();
    } catch (error) {
      console.error('Failed to toggle favorite status:', error);
    }
  }, [characterService, fetchCharacters]);

  const tagFilterOptions = allTags.map(tag => ({ label: tag.name, value: tag.id }));
  const sortOptions = [
    { label: t('sort_by_name'), value: 'name' },
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' },
  ];

  const handleSortDirectionChange = (direction: 'asc' | 'desc') => {
    setSortDirection(direction);
  };

  const handleFilterChange = useCallback((selectedValues: string[]) => {
    setActiveFilterTags(selectedValues);
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });

  return (
    <View style={styles.container}>
      <GenericFilterSortList
        data={filteredCharacters}
        renderItem={({ item }) => <CharacterListItem character={item} onToggleFavorite={handleToggleFavorite} />}
        keyExtractor={(item) => item.id}
        onSearch={setActiveSearch}
        searchPlaceholder={t('search_characters')}
        filterOptions={tagFilterOptions}
        onFilterChange={handleFilterChange} // Updated to handle array
        selectedFilterValues={activeFilterTags} // Pass selected values
        sortOptions={sortOptions}
        onSortChange={setActiveSort}
        onSortDirectionChange={handleSortDirectionChange}
        currentSortDirection={sortDirection}
      />
    </View>
  );
};

export default CharactersScreen;
