import { create } from 'zustand';
import { CharacterWithTags, CharacterService, createCharacterService } from '../services/CharacterService'; // Import CharacterWithTags
import { AppDrizzleClient } from '../db'; // Import AppDrizzleClient

interface CharacterState {
  characters: CharacterWithTags[];
  searchTerm: string;
  activeFilterTags: string[];
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  db: AppDrizzleClient | null;
  storyId: string | null;
  characterService: CharacterService | null;

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchCharacters: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setFilterTags: (tags: string[]) => void;
  setSort: (sortBy: string | null, direction: 'asc' | 'desc') => void;
  toggleFavorite: (characterId: string, isFavorite: boolean) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  searchTerm: '',
  activeFilterTags: [],
  activeSort: null,
  sortDirection: 'asc',
  loading: false,
  error: null,
  db: null,
  storyId: null,
  characterService: null,

  setDbAndStoryId: (dbInstance, storyIdInstance) => set({ db: dbInstance, storyId: storyIdInstance }),

  initializeService: () => {
    const { db } = get();
    if (db && !get().characterService) {
      set({ characterService: createCharacterService(db) });
    }
  },

  fetchCharacters: async () => {
    set({ loading: true, error: null });
    const { characterService, storyId, searchTerm, activeFilterTags, activeSort, sortDirection } = get();

    if (!characterService || !storyId) {
      set({ loading: false, error: 'Character service or story ID not set.' });
      return;
    }

    try {
      const fetchedCharacters = await characterService.getCharactersByStoryId(
        storyId,
        searchTerm,
        activeFilterTags.length > 0 ? activeFilterTags : undefined,
        activeSort || undefined,
        sortDirection
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
  },

  setSort: (sortBy, direction) => {
    set({ activeSort: sortBy, sortDirection: direction });
  },

  toggleFavorite: async (characterId, isFavorite) => {
    const { characterService, characters } = get();
    if (!characterService) {
      console.error('Character service not set.');
      return;
    }

    // Optimistic update
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === characterId ? { ...char, isFavorite: isFavorite } : char
      ),
    }));

    try {
      await characterService.updateCharacter(characterId, { isFavorite });
      // Re-fetch to ensure consistency with backend/database
      get().fetchCharacters();
    } catch (err) {
      console.error('Failed to toggle favorite status:', err);
      set({ error: 'Failed to update favorite status.' });
      // Revert optimistic update if necessary, or just re-fetch
      get().fetchCharacters();
    }
  },
}));
