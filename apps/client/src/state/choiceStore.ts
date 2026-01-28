import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { ChoiceSelect } from '../db/schemas/choices';
import { createChoiceService } from '../services/storymanagement/ChoiceService';

interface ChoiceState {
  choices: ChoiceSelect[];
  choiceService: ReturnType<typeof createChoiceService> | null;
  searchTerm: string;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  advancedSearchCriteria: { [key: string]: any };
  loading: boolean;
  error: string | null;
  drizzleDb: AppDrizzleClient | null;
  storyId: string | null;
}

interface ChoiceActions {
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchChoices: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
}

export const useChoiceStore = create<ChoiceState & ChoiceActions>()(
  persist(
    (set, get) => ({
      choices: [],
      choiceService: null,
      searchTerm: '',
      activeSort: 'createdAt',
      sortDirection: 'asc',
      advancedSearchCriteria: {},
      loading: false,
      error: null,
      drizzleDb: null,
      storyId: null,

      setDbAndStoryId: (db, storyId) => set({ drizzleDb: db, storyId: storyId }),

      initializeService: () => {
        const { drizzleDb } = get();
        if (drizzleDb && !get().choiceService) {
          set({ choiceService: createChoiceService(drizzleDb) });
        }
      },

      fetchChoices: async () => {
        const { choiceService, storyId, searchTerm, activeSort, sortDirection, advancedSearchCriteria } = get();
        if (!choiceService || !storyId) {
          console.warn('Choice service or storyId not initialized.');
          set({ choices: [], loading: false });
          return;
        }

        set({ loading: true, error: null });
        try {
          const fetchedChoices = await choiceService.getChoicesByStoryId(
            storyId,
            searchTerm,
            activeSort,
            sortDirection,
            'all', // Favorite filter removed, so pass 'all'
            advancedSearchCriteria
          );
          set({ choices: fetchedChoices, loading: false });
        } catch (err: any) {
          console.error('Failed to fetch choices:', err);
          set({ error: err.message || 'Failed to fetch choices', loading: false });
        }
      },

      setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().fetchChoices();
      },

      setSort: (sortBy, sortDirection) => {
        set({ activeSort: sortBy, sortDirection: sortDirection });
        get().fetchChoices();
      },

      setAdvancedSearchCriteria: (criteria) => {
        set({ advancedSearchCriteria: criteria });
        get().fetchChoices();
      },
    }),
    {
      name: 'choice-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        searchTerm: state.searchTerm,
        activeSort: state.activeSort,
        sortDirection: state.sortDirection,
        advancedSearchCriteria: state.advancedSearchCriteria
      }),
    }
  )
);