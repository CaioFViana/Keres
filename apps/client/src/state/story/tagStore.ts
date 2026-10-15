import type { TagSelect } from '@/src/db/schemas/tags';
import type { TagService } from '@/src/services/storymanagement/notes-tags-comments/TagService';
import { createTagService } from '@/src/services/storymanagement/notes-tags-comments/TagService';
import { createEntityStore } from '@/src/state/lib/createEntityStore';

export type { FavoriteFilterState } from '@/src/types/entityFilters';

export const useTagStore = createEntityStore<'tags', TagSelect, TagService>({
  collectionKey: 'tags',
  favoriteEntityType: 'Tag',
  createService: createTagService,
  fetchEntities: (service, p) =>
    service.getTagsByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeFilterTags,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateTag(userId, id, { isFavorite }),
  changeEvent: 'tag_changed',
  persistKey: 'tag-storage',
  errorMessages: {
    fetch: 'Failed to load tags.',
    toggleFavorite: 'Failed to update tag favorite status.',
  },
});
