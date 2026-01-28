import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { ItemSelect } from '../db/schemas/items';
import { createItemService } from '../services/ItemService';

interface ItemState {
  items: ItemSelect[];
  itemService: ReturnType<typeof createItemService> | null;
  searchTerm: string;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  advancedSearchCriteria: { [key: string]: any };
  loading: boolean;
  error: string | null;
  drizzleDb: AppDrizzleClient | null;
  storyId: string | null;
}

interface ItemActions {
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchItems: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
}

export const useItemStore = create<ItemState & ItemActions>()(
  persist(
    (set, get) => ({
      items: [],
      itemService: null,
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
        if (drizzleDb && !get().itemService) {
          set({ itemService: createItemService(drizzleDb) });
        }
      },

      fetchItems: async () => {
        const { itemService, storyId, searchTerm, activeSort, sortDirection, advancedSearchCriteria } = get();
        if (!itemService || !storyId) {
          console.warn('Item service or storyId not initialized.');
          set({ items: [], loading: false });
          return;
        }

        set({ loading: true, error: null });
        try {
          const fetchedItems = await itemService.getItemsByStoryId(
            storyId,
            searchTerm,
            activeSort,
            sortDirection,
            'all', // Assuming 'all' as default for favorite filter for now
            advancedSearchCriteria
          );
          set({ items: fetchedItems, loading: false });
        } catch (err: any) {
          console.error('Failed to fetch items:', err);
          set({ error: err.message || 'Failed to fetch items', loading: false });
        }
      },

      setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().fetchItems();
      },

      setSort: (sortBy, sortDirection) => {
        set({ activeSort: sortBy, sortDirection: sortDirection });
        get().fetchItems();
      },

      setAdvancedSearchCriteria: (criteria) => {
        set({ advancedSearchCriteria: criteria });
        get().fetchItems();
      },
    }),
    {
      name: 'item-storage',
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