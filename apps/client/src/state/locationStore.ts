import type {
  LocationService,
  LocationWithTags} from '../services/storymanagement/LocationService';
import {
  createLocationService
} from '../services/storymanagement/LocationService';
import { createEntityStore } from './createEntityStore';

export const useLocationStore = createEntityStore<'locations', LocationWithTags, LocationService>({
  collectionKey: 'locations',
  favoriteEntityType: 'Location',
  createService: createLocationService,
  fetchEntities: (service, p) =>
    service.getLocationsByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeFilterTags.length > 0 ? p.activeFilterTags : undefined,
      p.favoriteFilterState,
      p.activeSort || undefined,
      p.sortDirection,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateLocation(userId, id, { isFavorite }),
  changeEvent: 'location_changed',
  errorMessages: {
    fetch: 'Failed to fetch locations.',
    toggleFavorite: 'Failed to update favorite status.',
  },
});
