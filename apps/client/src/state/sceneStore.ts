import { SceneSelect } from '../db/schema';
import { createSceneService, SceneService } from '../services/storymanagement/SceneService';
import { createEntityStore } from './createEntityStore';
import { useUserSettingsStore } from './userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

interface SceneExtraActions {
  reorderScenes: (chapterId: string, newOrder: { id: string; newIndex: number }[]) => Promise<void>;
}

export const useSceneStore = createEntityStore<
  'scenes',
  SceneSelect,
  SceneService,
  SceneExtraActions
>({
  collectionKey: 'scenes',
  favoriteEntityType: 'Scene',
  createService: createSceneService,
  fetchEntities: (service, p) =>
    service.getScenesByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateScene(userId, id, { isFavorite }),
  changeEvent: 'scene_changed',
  defaultSort: 'index',
  persistKey: 'scene-storage',
  errorMessages: { fetch: 'Failed to fetch scenes.' },

  extraActions: ({ get, setPartial, refetch }) => ({
    reorderScenes: async (chapterId: string, newOrder: { id: string; newIndex: number }[]) => {
      const { service, storyId } = get();
      if (!service || !storyId) {
        console.warn('Scene service or storyId not initialized for reordering.');
        return;
      }

      const userId = useUserSettingsStore.getState().userId;
      if (!userId) {
        console.error('User ID not available. Cannot reorder scenes.');
        return;
      }

      setPartial({ loading: true, error: null });
      try {
        await service.reorderScenes(userId, storyId, chapterId, newOrder);
        entityEventEmitter.emit('scene_changed', storyId, 'reorder');
        await refetch(); // Re-fetch to pick up the new order and entity versions
      } catch (err: any) {
        console.error('Failed to reorder scenes:', err);
        setPartial({ error: err?.message || 'Failed to reorder scenes', loading: false });
      }
    },
  }),
});
