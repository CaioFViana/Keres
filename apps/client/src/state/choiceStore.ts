import { ChoiceSelect } from '../db/schemas/choices';
import { ChoiceService, createChoiceService } from '../services/storymanagement/ChoiceService';
import { createEntityStore } from './createEntityStore';

export const useChoiceStore = createEntityStore<'choices', ChoiceSelect, ChoiceService>({
  collectionKey: 'choices',
  createService: createChoiceService,
  fetchEntities: (service, p) =>
    service.getChoicesByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeSort,
      p.sortDirection,
      'all', // Choices have no favourite filter.
      p.advancedSearchCriteria,
    ),
  defaultSort: 'createdAt',
  persistKey: 'choice-storage',
  errorMessages: { fetch: 'Failed to fetch choices.' },
});
