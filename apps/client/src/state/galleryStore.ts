import type { MediaType } from '@keres/shared';
import type { GallerySelect } from '../db/schemas/galleries';
import type { GalleryService } from '../services/storymanagement/GalleryService';
import { createGalleryService } from '../services/storymanagement/GalleryService';
import { createEntityStore } from './createEntityStore';

export type { FavoriteFilterState } from '../types/entityFilters';

/**
 * The gallery does not filter by tags, so the store factory's generic `activeFilterTags` slot carries
 * the selected media types here ('image' | 'video' | 'audio'). Reusing the slot is what allows using
 * `useEntityListScreen` and the shared filter bar without a parallel path just for this screen.
 */
export const useGalleryStore = createEntityStore<'galleries', GallerySelect, GalleryService>({
  collectionKey: 'galleries',
  favoriteEntityType: 'Gallery',
  createService: createGalleryService,
  fetchEntities: (service, p) =>
    service.getGalleriesByStoryId(p.storyId, {
      searchTerm: p.searchTerm,
      mediaTypes: p.activeFilterTags as MediaType[],
      favoriteFilterState: p.favoriteFilterState,
      sortBy: p.activeSort,
      sortDirection: p.sortDirection,
    }),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateGalleryFavoriteStatus(userId, id, isFavorite),
  changeEvent: 'gallery_changed',
  defaultSort: 'createdAt',
  defaultSortDirection: 'desc',
  errorMessages: {
    fetch: 'Failed to load gallery media.',
    toggleFavorite: 'Failed to update media favorite status.',
  },
});
