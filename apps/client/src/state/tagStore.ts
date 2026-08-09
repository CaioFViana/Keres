import { TagSelect } from '../db/schemas/tags';
import { createTagService, TagService } from '../services/storymanagement/TagService';
import { createEntityStore } from './createEntityStore';

export type { FavoriteFilterState } from '../types/entityFilters';

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
  updateFavorite: (service, userId, id, isFavorite) => service.updateTag(userId, id, { isFavorite }),
  changeEvent: 'tag_changed',
  errorMessages: {
    fetch: 'Failed to load tags.',
    toggleFavorite: 'Failed to update tag favorite status.',
  },
});
