import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { ItemJourneySelect } from '../db/schemas/itemJourneys';
import { createItemJourneyService } from '../services/storymanagement/ItemJourneyService';

interface ItemJourneyState {
  itemJourneys: ItemJourneySelect[];
  itemJourneyService: ReturnType<typeof createItemJourneyService> | null;
  searchTerm: string;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  advancedSearchCriteria: { [key: string]: any };
  loading: boolean;
  error: string | null;
  drizzleDb: AppDrizzleClient | null;
  storyId: string | null;
}

interface ItemJourneyActions {
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchItemJourneys: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
}

export const useItemJourneyStore = create<ItemJourneyState & ItemJourneyActions>()(
  persist(
    (set, get) => ({
      itemJourneys: [],
      itemJourneyService: null,
      searchTerm: '',
      activeSort: 'createdAt',
      sortDirection: 'asc',
      advancedSearchCriteria: {},
      loading: false,
      error: null,
      drizzleDb: null,
      storyId: null,

      setDbAndStoryId: (db, storyId) => {
        set({ drizzleDb: db, storyId: storyId });
        get().initializeService(); // Initialize service immediately after setting DB and storyId
      },

      initializeService: () => {
        const { drizzleDb } = get();
        if (drizzleDb && !get().itemJourneyService) {
          set({ itemJourneyService: createItemJourneyService(drizzleDb) });
        }
      },

      fetchItemJourneys: async () => {
        const { itemJourneyService, storyId, searchTerm, activeSort, sortDirection, advancedSearchCriteria } = get();
        if (!itemJourneyService || !storyId) {
          console.warn('Item Journey service or storyId not initialized.');
          set({ itemJourneys: [], loading: false });
          return;
        }

        set({ loading: true, error: null });
        try {
          const fetchedItemJourneys = await itemJourneyService.getAllByStoryId(
            storyId,
          );
          set({ itemJourneys: fetchedItemJourneys, loading: false });
        } catch (err: any) {
          console.error('Failed to fetch item journeys:', err);
          set({ error: err.message || 'Failed to fetch item journeys', loading: false });
        }
      },

      setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().fetchItemJourneys();
      },

      setSort: (sortBy, sortDirection) => {
        set({ activeSort: sortBy, sortDirection: sortDirection });
        get().fetchItemJourneys();
      },

      setAdvancedSearchCriteria: (criteria) => {
        set({ advancedSearchCriteria: criteria });
        get().fetchItemJourneys();
      },
    }),
    {
      name: 'item-journey-storage',
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