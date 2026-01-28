import { create } from 'zustand';
import { AppDrizzleClient } from '../db';
import { CharacterRelationServiceInterface, CharacterRelationWithNames, createCharacterRelationService } from '../services/CharacterRelationService'; // Import CharacterRelationServiceInterface

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

interface CharacterRelationStore {
  db: AppDrizzleClient | null;
  storyId: string | null;
  service: CharacterRelationServiceInterface | null; // Use CharacterRelationServiceInterface
  characterRelations: CharacterRelationWithNames[]; // Changed type
  loading: boolean;
  error: string | null;
  searchTerm: string;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  advancedSearchCriteria: { [key: string]: any };

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchCharacterRelations: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  // No toggleFavorite as CharacterRelations don't have a favorite status
}

export const useCharacterRelationStore = create<CharacterRelationStore>((set, get) => ({
  db: null,
  storyId: null,
  service: null,
  characterRelations: [],
  loading: false,
  error: null,
  searchTerm: '',
  activeSort: 'relationType', // Default sort
  sortDirection: 'asc', // Default direction
  advancedSearchCriteria: {},

  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => {
    set({ db, storyId });
  },

  initializeService: () => {
    const { db } = get();
    if (db) {
      set({ service: createCharacterRelationService(db) });
    }
  },

  fetchCharacterRelations: async () => {
    const { service, storyId, searchTerm, activeSort, sortDirection, advancedSearchCriteria } = get();
    if (!service || !storyId) {
      set({ error: 'Service not initialized or storyId not set.' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const fetchedRelations = await service.getCharacterRelationsByStoryId(
        storyId,
        searchTerm,
        activeSort,
        sortDirection,
        advancedSearchCriteria
      );
      set({ characterRelations: fetchedRelations, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch character relations.', loading: false });
    }
  },

  setSearchTerm: (term: string) => {
    set({ searchTerm: term });
  },

  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => {
    set({ activeSort: sortBy, sortDirection: sortDirection });
    get().fetchCharacterRelations();
  },

  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => {
    set({ advancedSearchCriteria: criteria });
    get().fetchCharacterRelations();
  },
}));
