import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import CharacterListItem from '../components/character/CharacterListItem'; // Import the new CharacterListItem
import GenericFilterSortList from '../components/common/GenericFilterSortList/GenericFilterSortList';
import { useDrizzle } from '../db';
import { CharacterSelect, TagSelect } from '../db/schema'; // Corrected import for TagSelect
import { createCharacterService } from '../services/CharacterService'; // Will create this service
import { createTagService } from '../services/TagService'; // Will create this service
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';


const CharactersScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();

  const [characters, setCharacters] = useState<CharacterSelect[]>([]);
  const [filteredCharacters, setFilteredCharacters] = useState<CharacterSelect[]>([]);
  const [allTags, setAllTags] = useState<TagSelect[]>([]); // Corrected type
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // New state for sort direction

  const characterService = useRef(createCharacterService(drizzleDb)).current; // Initialize service once
  const tagService = useRef(createTagService(drizzleDb)).current; // Initialize service once

  const fetchCharacters = useCallback(async () => {
    if (!selectedStory?.id) {
      setCharacters([]);
      setFilteredCharacters([]);
      return;
    }
    try {
      const fetchedCharacters = await characterService.getCharactersByStoryId(selectedStory.id);
      setCharacters(fetchedCharacters);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    }
  }, [selectedStory?.id]);

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

  useEffect(() => {
    let tempCharacters = [...characters];

    // Apply search
    if (activeSearch) {
      tempCharacters = tempCharacters.filter(char =>
        char.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        (char.description && char.description.toLowerCase().includes(activeSearch.toLowerCase()))
      );
    }

    // Apply filter (by tags - this will require tag-character relation implementation)
    // For now, let's assume `character` has a `tags` array of Tag objects
    if (activeFilter) {
      // This part needs actual tag relationships in your schema and data
      // Placeholder logic:
      // tempCharacters = tempCharacters.filter(char => char.tags?.some(tag => tag.id === activeFilter));
    }

    // Apply sort
    if (activeSort) {
      tempCharacters.sort((a, b) => {
        let comparison = 0;
        if (activeSort === 'name') {
          comparison = a.name.localeCompare(b.name);
        }
        if (activeSort === 'createdAt') {
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (activeSort === 'updatedAt') {
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredCharacters(tempCharacters);
  }, [characters, activeSearch, activeFilter, activeSort, sortDirection]); // Added sortDirection to dependencies

  const tagFilterOptions = allTags.map(tag => ({ label: tag.name, value: tag.id }));
  const sortOptions = [
    { label: t('sort_by_name'), value: 'name' },
    { label: t('sort_by_created_at'), value: 'createdAt' },
    { label: t('sort_by_updated_at'), value: 'updatedAt' },
  ];

  const handleSortDirectionChange = (direction: 'asc' | 'desc') => {
    setSortDirection(direction);
  };

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
        renderItem={({ item }) => <CharacterListItem character={item} />}
        keyExtractor={(item) => item.id}
        onSearch={setActiveSearch}
        searchPlaceholder={t('search_characters')}
        filterOptions={tagFilterOptions}
        onFilterChange={setActiveFilter}
        sortOptions={sortOptions}
        onSortChange={setActiveSort}
        onSortDirectionChange={handleSortDirectionChange} // Pass the new handler
        currentSortDirection={sortDirection} // Pass the current sort direction
      />
    </View>
  );
};

export default CharactersScreen;
