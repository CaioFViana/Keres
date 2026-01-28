import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { ChapterSelect } from '../db/schema';
import { createChapterService, FavoriteFilterState } from '../services/storymanagement/ChapterService';
import { entityEventEmitter } from '../utils/EventEmitter';

interface ChapterState {
  chapters: ChapterSelect[];
  chapterService: ReturnType<typeof createChapterService> | null;
  searchTerm: string;
  activeSort: string | null;
  sortDirection: 'asc' | 'desc';
  favoriteFilterState: FavoriteFilterState;
  advancedSearchCriteria: { [key: string]: any };
  loading: boolean;
  error: string | null;
  drizzleDb: AppDrizzleClient | null;
  storyId: string | null;
}

interface ChapterActions {
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchChapters: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  toggleFavorite: (chapterId: string, currentIsFavorite: boolean) => Promise<void>;
  reorderChapters: (newOrder: { id: string, newIndex: number }[]) => Promise<void>;
}

export const useChapterStore = create<ChapterState & ChapterActions>()(
  persist(
    (set, get) => ({
      chapters: [],
      chapterService: null,
      searchTerm: '',
      activeSort: 'index', // Default sort by index
      sortDirection: 'asc', // Default ascending
      favoriteFilterState: 'all',
      advancedSearchCriteria: {},
      loading: false,
      error: null,
      drizzleDb: null,
      storyId: null,

      setDbAndStoryId: (db, storyId) => set({ drizzleDb: db, storyId: storyId }),

      initializeService: () => {
        const { drizzleDb } = get();
        if (drizzleDb && !get().chapterService) {
          set({ chapterService: createChapterService(drizzleDb) });
        }
      },

      fetchChapters: async () => {
        const { chapterService, storyId, searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria } = get();
        if (!chapterService || !storyId) {
          console.warn('Chapter service or storyId not initialized.');
          return;
        }

        set({ loading: true, error: null });
        try {
          const fetchedChapters = await chapterService.getChaptersByStoryId(
            storyId,
            searchTerm,
            activeSort,
            sortDirection,
            favoriteFilterState,
            advancedSearchCriteria
          );
          set({ chapters: fetchedChapters, loading: false });
        } catch (err: any) {
          console.error('Failed to fetch chapters:', err);
          set({ error: err.message || 'Failed to fetch chapters', loading: false });
        }
      },

      setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().fetchChapters();
      },

      setSort: (sortBy, sortDirection) => {
        set({ activeSort: sortBy, sortDirection: sortDirection });
        get().fetchChapters();
      },

      setFavoriteFilter: (state) => {
        set({ favoriteFilterState: state });
        get().fetchChapters();
      },

      setAdvancedSearchCriteria: (criteria) => {
        set({ advancedSearchCriteria: criteria });
        get().fetchChapters();
      },

      toggleFavorite: async (chapterId, currentIsFavorite) => {
        const { chapterService, storyId } = get();
        if (!chapterService || !storyId) {
          console.warn('Chapter service or storyId not initialized for toggling favorite.');
          return;
        }

        try {
          // Optimistic update
          set(state => ({
            chapters: state.chapters.map(chap =>
              chap.id === chapterId ? { ...chap, isFavorite: !currentIsFavorite } : chap
            ),
          }));

          const userId = 'local_user'; // TODO: Replace with actual userId
          await chapterService.updateChapter(userId, chapterId, { isFavorite: !currentIsFavorite });
          entityEventEmitter.emit('chapter_changed', storyId, chapterId);
          get().fetchChapters(); // Re-fetch to ensure consistency and get new version
        } catch (err: any) {
          console.error('Failed to toggle favorite status for chapter:', err);
          set(state => ({
            // Revert optimistic update on error
            chapters: state.chapters.map(chap =>
              chap.id === chapterId ? { ...chap, isFavorite: currentIsFavorite } : chap
            ),
            error: err.message || 'Failed to toggle favorite status',
          }));
        }
      },

      reorderChapters: async (newOrder) => {
        const { chapterService, storyId } = get();
        if (!chapterService || !storyId) {
          console.warn('Chapter service or storyId not initialized for reordering.');
          return;
        }

        set({ loading: true, error: null });
        try {
          const userId = 'local_user'; // TODO: Replace with actual userId
          await chapterService.reorderChapters(userId, storyId, newOrder);
          entityEventEmitter.emit('chapter_changed', storyId, 'reorder'); // Emit a generic change for reorder
          get().fetchChapters(); // Re-fetch all chapters to reflect new order and versions
        } catch (err: any) {
          console.error('Failed to reorder chapters:', err);
          set({ error: err.message || 'Failed to reorder chapters', loading: false });
        }
      },
    }),
    {
      name: 'chapter-storage', // unique name
      storage: createJSONStorage(() => localStorage), // for web, or use AsyncStorage for React Native
      partialize: (state) => ({ searchTerm: state.searchTerm, activeSort: state.activeSort, sortDirection: state.sortDirection, favoriteFilterState: state.favoriteFilterState, advancedSearchCriteria: state.advancedSearchCriteria }),
    }
  )
);
