import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppDrizzleClient } from '../db';
import { SceneSelect } from '../db/schema';
import { createSceneService, FavoriteFilterState } from '../services/storymanagement/SceneService';
import { entityEventEmitter } from '../utils/EventEmitter';

interface SceneState {
  scenes: SceneSelect[];
  sceneService: ReturnType<typeof createSceneService> | null;
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

interface SceneActions {
  setDbAndStoryId: (db: AppDrizzleClient, storyId: string) => void;
  initializeService: () => void;
  fetchScenes: () => Promise<void>;
  setSearchTerm: (term: string) => void;
  setSort: (sortBy: string | null, sortDirection: 'asc' | 'desc') => void;
  setFavoriteFilter: (state: FavoriteFilterState) => void;
  setAdvancedSearchCriteria: (criteria: { [key: string]: any }) => void;
  toggleFavorite: (sceneId: string, currentIsFavorite: boolean) => Promise<void>;
  reorderScenes: (chapterId: string, newOrder: { id: string, newIndex: number }[]) => Promise<void>;
}

export const useSceneStore = create<SceneState & SceneActions>()(
  persist(
    (set, get) => ({
      scenes: [],
      sceneService: null,
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
        if (drizzleDb && !get().sceneService) {
          set({ sceneService: createSceneService(drizzleDb) });
        }
      },

      fetchScenes: async () => {
        const { sceneService, storyId, searchTerm, activeSort, sortDirection, favoriteFilterState, advancedSearchCriteria } = get();
        if (!sceneService || !storyId) {
          console.warn('Scene service or storyId not initialized.');
          return;
        }

        set({ loading: true, error: null });
        try {
          const fetchedScenes = await sceneService.getScenesByStoryId(
            storyId,
            searchTerm,
            activeSort,
            sortDirection,
            favoriteFilterState,
            advancedSearchCriteria
          );
          set({ scenes: fetchedScenes, loading: false });
        } catch (err: any) {
          console.error('Failed to fetch scenes:', err);
          set({ error: err.message || 'Failed to fetch scenes', loading: false });
        }
      },

      setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().fetchScenes();
      },

      setSort: (sortBy, sortDirection) => {
        set({ activeSort: sortBy, sortDirection: sortDirection });
        get().fetchScenes();
      },

      setFavoriteFilter: (state) => {
        set({ favoriteFilterState: state });
        get().fetchScenes();
      },

      setAdvancedSearchCriteria: (criteria) => {
        set({ advancedSearchCriteria: criteria });
        get().fetchScenes();
      },

      toggleFavorite: async (sceneId, currentIsFavorite) => {
        const { sceneService, storyId } = get();
        if (!sceneService || !storyId) {
          console.warn('Scene service or storyId not initialized for toggling favorite.');
          return;
        }

        try {
          // Optimistic update
          set(state => ({
            scenes: state.scenes.map(scn =>
              scn.id === sceneId ? { ...scn, isFavorite: !currentIsFavorite } : scn
            ),
          }));

          const userId = 'local_user'; // TODO: Replace with actual userId
          await sceneService.updateScene(userId, sceneId, { isFavorite: !currentIsFavorite });
          entityEventEmitter.emit('scene_changed', storyId, sceneId);
          get().fetchScenes(); // Re-fetch to ensure consistency and get new version
        } catch (err: any) {
          console.error('Failed to toggle favorite status for scene:', err);
          set(state => ({
            // Revert optimistic update on error
            scenes: state.scenes.map(scn =>
              scn.id === sceneId ? { ...scn, isFavorite: currentIsFavorite } : scn
            ),
            error: err.message || 'Failed to toggle favorite status',
          }));
        }
      },

      reorderScenes: async (chapterId, newOrder) => {
        const { sceneService, storyId } = get();
        if (!sceneService || !storyId) {
          console.warn('Scene service or storyId not initialized for reordering.');
          return;
        }

        set({ loading: true, error: null });
        try {
          const userId = 'local_user'; // TODO: Replace with actual userId
          await sceneService.reorderScenes(userId, storyId, chapterId, newOrder);
          entityEventEmitter.emit('scene_changed', storyId, 'reorder'); // Emit a generic change for reorder
          get().fetchScenes(); // Re-fetch all scenes to reflect new order and versions
        } catch (err: any) {
          console.error('Failed to reorder scenes:', err);
          set({ error: err.message || 'Failed to reorder scenes', loading: false });
        }
      },
    }),
    {
      name: 'scene-storage', // unique name
      storage: createJSONStorage(() => localStorage), // for web, or use AsyncStorage for React Native
      partialize: (state) => ({ searchTerm: state.searchTerm, activeSort: state.activeSort, sortDirection: state.sortDirection, favoriteFilterState: state.favoriteFilterState, advancedSearchCriteria: state.advancedSearchCriteria }),
    }
  )
);
