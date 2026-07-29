import { ChapterSelect } from '../db/schema';
import { ChapterService, createChapterService } from '../services/storymanagement/ChapterService';
import { createEntityStore } from './createEntityStore';
import { useUserSettingsStore } from './userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

interface ChapterExtraActions {
  reorderChapters: (newOrder: { id: string; newIndex: number }[]) => Promise<void>;
}

export const useChapterStore = createEntityStore<
  'chapters',
  ChapterSelect,
  ChapterService,
  ChapterExtraActions
>({
  collectionKey: 'chapters',
  createService: createChapterService,
  fetchEntities: (service, p) =>
    service.getChaptersByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateChapter(userId, id, { isFavorite }),
  changeEvent: 'chapter_changed',
  defaultSort: 'index',
  persistKey: 'chapter-storage',
  errorMessages: { fetch: 'Failed to fetch chapters.' },

  extraActions: ({ get, setPartial, refetch }) => ({
    reorderChapters: async (newOrder: { id: string; newIndex: number }[]) => {
      const { service, storyId } = get();
      if (!service || !storyId) {
        console.warn('Chapter service or storyId not initialized for reordering.');
        return;
      }

      const userId = useUserSettingsStore.getState().userId;
      if (!userId) {
        console.error('User ID not available. Cannot reorder chapters.');
        return;
      }

      setPartial({ loading: true, error: null });
      try {
        await service.reorderChapters(userId, storyId, newOrder);
        entityEventEmitter.emit('chapter_changed', storyId, 'reorder');
        await refetch(); // Re-fetch to pick up the new order and entity versions
      } catch (err: any) {
        console.error('Failed to reorder chapters:', err);
        setPartial({ error: err?.message || 'Failed to reorder chapters', loading: false });
      }
    },
  }),
});
