import { create } from 'zustand';
import { AppDrizzleClient } from '../db'; // Import AppDrizzleClient
import { CharacterService, CharacterWithTags, createCharacterService } from '../services/storymanagement/CharacterService'; // Import CharacterWithTags
import { entityEventEmitter } from '../utils/EventEmitter'; // Import entityEventEmitter
import { useUserSettingsStore } from './userSettingsStore';

type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface CharacterState {
  characters: CharacterWithTags[];
  searchTerm: string;
  activeFilterTags: string[];
  favoriteFilterState: FavoriteFilterState;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  characterService: CharacterService | null;
  advancedSearchCriteria: { [key: string]: any }; // Added
  
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchCharacters: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tags: string[]) => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (characterId: string, isFavorite: boolean) => Promise<void>;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void; // Added
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  searchTerm: '',
  activeFilterTags: [],
  favoriteFilterState: 'all',
  activeSort: null,
  sortDirection: 'asc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  characterService: null,
  advancedSearchCriteria: {}, // Added

  setDbAndStoryId: (dbInstance, storyIdInstance) => set({ db: dbInstance, storyId: storyIdInstance }),

  initializeService: () => {
    const { db } = get();
    if (db && !get().characterService) {
      set({ characterService: createCharacterService(db) });
    }
  },

  fetchCharacters: async () => {
    set({ loading: true, error: null });
    const { characterService, storyId, searchTerm, activeFilterTags, favoriteFilterState, activeSort, sortDirection, advancedSearchCriteria } = get(); // Added advancedSearchCriteria

    if (!characterService || !storyId) {
      set({ loading: false, error: 'Character service or story ID not set.' });
      return;
    }

    try {
      const fetchedCharacters = await characterService.getCharactersByStoryId(
        storyId,
        searchTerm,
        activeFilterTags.length > 0 ? activeFilterTags : undefined,
        favoriteFilterState,
        activeSort || undefined,
        sortDirection,
        advancedSearchCriteria // Pass advancedSearchCriteria
      );
      set({ characters: fetchedCharacters, loading: false });
    } catch (err) {
      console.error('Failed to fetch characters:', err);
      set({ error: 'Failed to fetch characters.', loading: false });
    }
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  setFilterTags: (tags) => {
    set({ activeFilterTags: tags });
    get().fetchCharacters();
  },

  setFavoriteFilter: (state) => {
    set({ favoriteFilterState: state });
    get().fetchCharacters();
  },

  setSort: (sortBy, direction) => {
    set({ activeSort: sortBy, sortDirection: direction });
    get().fetchCharacters();
  },

  toggleFavorite: async (characterId, isFavorite) => {
    const { characterService, storyId } = get(); // Get storyId from get()
    if (!characterService) {
      console.error('Character service not set.');
      return;
    }
    if (!storyId) { // Added check for storyId
      console.error('Story ID not available. Cannot toggle character favorite status.');
      return;
    }

    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId ? { ...char, isFavorite: isFavorite } : char
      ),
    }));

    const userId = useUserSettingsStore.getState().userId; // Get userId from the store
    if (!userId) {
      console.error('User ID not available. Cannot toggle character favorite status.');
      return;
    }

    try {
      await characterService.updateCharacter(userId, characterId, { isFavorite });
      entityEventEmitter.emit('character_changed', storyId); // Added this line for consistency
    } catch (err) {
      console.error('Failed to toggle favorite status:', err);
      set({ error: 'Failed to update favorite status.' });
    }
  },

  setAdvancedSearchCriteria: (criteria) => {
    set({ advancedSearchCriteria: criteria });
    get().fetchCharacters();
  },
}));
