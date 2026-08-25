import type { WorldRuleWithTags } from '../db/schemas/worldRules';
import type { WorldRuleService } from '../services/storymanagement/WorldRuleService';
import { createWorldRuleService } from '../services/storymanagement/WorldRuleService';
import { createEntityStore } from './createEntityStore';

export const useWorldRuleStore = createEntityStore<
  'worldRules',
  WorldRuleWithTags,
  WorldRuleService
>({
  collectionKey: 'worldRules',
  favoriteEntityType: 'WorldRule',
  createService: createWorldRuleService,
  fetchEntities: (service, p) =>
    service.getWorldRulesByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeFilterTags,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateWorldRule(userId, id, { isFavorite }),
  changeEvent: 'worldrule_changed',
  errorMessages: {
    fetch: 'Failed to load world rules.',
    toggleFavorite: 'Failed to update world rule favorite status.',
  },
});
