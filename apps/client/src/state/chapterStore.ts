import type { ChapterType } from '@keres/shared';
import type { ChapterSelect } from '../db/schema';
import type { ChapterService } from '../services/storymanagement/ChapterService';
import { createChapterService } from '../services/storymanagement/ChapterService';
import { createEntityStore } from './createEntityStore';
import { useUserSettingsStore } from './userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

interface ChapterExtraActions {
  reorderChapters: (
    newOrder: { id: string; newIndex: number }[],
    type?: ChapterType,
  ) => Promise<void>;
  /** Moves a container between the two kinds - see `ChapterService.convertChapterType`. */
  convertChapterType: (
    chapterId: string,
    targetType: ChapterType,
    position?: number,
  ) => Promise<void>;
}

export const useChapterStore = createEntityStore<
  'chapters',
  ChapterSelect,
  ChapterService,
  ChapterExtraActions
>({
  collectionKey: 'chapters',
  favoriteEntityType: 'Chapter',
  createService: createChapterService,
  fetchEntities: (service, p) =>
    service.getChaptersByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
      // Both kinds in one list: events are containers of scenes like any chapter, and the drawer
      // shows the story's containers. The service groups them, events first.
      null,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateChapter(userId, id, { isFavorite }),
  changeEvent: 'chapter_changed',
  defaultSort: 'index',
  persistKey: 'chapter-storage',
  errorMessages: { fetch: 'Failed to fetch chapters.' },

  extraActions: ({ get, setPartial, refetch }) => ({
    reorderChapters: async (newOrder: { id: string; newIndex: number }[], type?: ChapterType) => {
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
        await service.reorderChapters(userId, storyId, newOrder, type);
        entityEventEmitter.emit('chapter_changed', storyId, 'reorder');
        await refetch(); // Re-fetch to pick up the new order and entity versions
      } catch (err: any) {
        console.error('Failed to reorder chapters:', err);
        setPartial({ error: err?.message || 'Failed to reorder chapters', loading: false });
      }
    },

    convertChapterType: async (chapterId: string, targetType: ChapterType, position?: number) => {
      const { service, storyId } = get();
      if (!service || !storyId) {
        console.warn('Chapter service or storyId not initialized for conversion.');
        return;
      }

      const userId = useUserSettingsStore.getState().userId;
      if (!userId) {
        console.error('User ID not available. Cannot convert a chapter.');
        return;
      }

      setPartial({ loading: true, error: null });
      try {
        await service.convertChapterType(userId, chapterId, targetType, position);
        entityEventEmitter.emit('chapter_changed', storyId, chapterId);
        await refetch();
      } catch (err: any) {
        console.error('Failed to convert the chapter:', err);
        setPartial({ error: err?.message || 'Failed to convert the chapter', loading: false });
        // Rethrown, unlike `reorderChapters` above: converting is a deliberate act on one container
        // and the screen has to be able to tell the writer it did not happen. Swallowing here would
        // close the modal and leave nothing behind, which reads as the app ignoring them.
        throw err;
      }
    },
  }),
});
