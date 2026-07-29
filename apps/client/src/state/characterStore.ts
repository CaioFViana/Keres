import { CharacterService, CharacterWithTags, createCharacterService } from '../services/storymanagement/CharacterService';
import { createEntityStore } from './createEntityStore';

export const useCharacterStore = createEntityStore<'characters', CharacterWithTags, CharacterService>({
  collectionKey: 'characters',
  createService: createCharacterService,
  fetchEntities: (service, p) =>
    service.getCharactersByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeFilterTags.length > 0 ? p.activeFilterTags : undefined,
      p.favoriteFilterState,
      p.activeSort || undefined,
      p.sortDirection,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateCharacter(userId, id, { isFavorite }),
  changeEvent: 'character_changed',
  errorMessages: {
    fetch: 'Failed to fetch characters.',
    toggleFavorite: 'Failed to update favorite status.',
  },
});
