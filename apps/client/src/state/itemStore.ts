import type { ItemSelect } from '../db/schemas/items';
import type { ItemService } from '../services/storymanagement/ItemService';
import { createItemService } from '../services/storymanagement/ItemService';
import { createEntityStore } from './createEntityStore';

export const useItemStore = createEntityStore<'items', ItemSelect, ItemService>({
  collectionKey: 'items',
  favoriteEntityType: 'Item',
  createService: createItemService,
  fetchEntities: (service, p) =>
    service.getItemsByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateItem(userId, id, { isFavorite }),
  changeEvent: 'item_changed',
  defaultSort: 'createdAt',
  persistKey: 'item-storage',
  errorMessages: { fetch: 'Failed to fetch items.' },
});
