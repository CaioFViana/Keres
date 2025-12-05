import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import NativeStackNavigationProp from native-stack
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import CharacterListItem from '../components/character/CharacterListItem';
import GenericFilterSortList from '../components/common/GenericFilterSortList/GenericFilterSortList';
import { useDrizzle } from '../db';
import { TagSelect } from '../db/schema';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../navigation/MainSystemStack'; // Import MainSystemDrawerParamList and CharacterStackParamList
import { CharacterWithTags, createCharacterService } from '../services/CharacterService';
import { createTagService } from '../services/TagService';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';

type CharactersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharactersStack'>, // 'CharactersStack' is the drawer screen name
  NativeStackNavigationProp<CharacterStackParamList, 'CharacterDetail'> // 'CharacterDetail' is a screen within CharacterStack
>;



const CharactersScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const drizzleDb = useDrizzle();
  const navigation = useNavigation<CharactersScreenNavigationProp>(); // Get the navigation object with specific type

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

  const handleViewDetails = useCallback((characterId: string) => {
    // Navigate to the Detail screen, passing the entityType and itemId
    // This assumes that 'Detail' screen is accessible from the navigation stack.
    // Given the previous error, we are typing the navigation prop to include 'Detail'.
    navigation.navigate('CharacterDetail', { characterId });
  }, [navigation]);

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
        renderItem={({ item }) => (
          <CharacterListItem
            character={item}
            onToggleFavorite={handleToggleFavorite}
            onViewDetails={handleViewDetails}
          />
        )}
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
