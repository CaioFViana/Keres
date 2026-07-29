import { ItemSelect } from '../db/schemas/items';
import { createItemService, ItemService } from '../services/storymanagement/ItemService';
import { createEntityStore } from './createEntityStore';

export const useItemStore = createEntityStore<'items', ItemSelect, ItemService>({
  collectionKey: 'items',
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
  defaultSort: 'createdAt',
  persistKey: 'item-storage',
  errorMessages: { fetch: 'Failed to fetch items.' },
});
