import { CharacterRelationServiceInterface, CharacterRelationWithNames, createCharacterRelationService } from '../services/storymanagement/CharacterRelationService';
import { createEntityStore } from './createEntityStore';

export type { FavoriteFilterState } from '../types/entityFilters';

export const useCharacterRelationStore = createEntityStore<
  'characterRelations',
  CharacterRelationWithNames,
  CharacterRelationServiceInterface
>({
  collectionKey: 'characterRelations',
  createService: createCharacterRelationService,
  // Character relations have no favourite flag, so no updateFavorite is configured.
  fetchEntities: (service, p) =>
    service.getCharacterRelationsByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      p.advancedSearchCriteria,
    ),
  defaultSort: 'relationType',
  errorMessages: { fetch: 'Failed to fetch character relations.' },
});
