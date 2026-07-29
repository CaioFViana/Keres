import { ItemJourneySelect } from '../db/schemas/itemJourneys';
import { createItemJourneyService, ItemJourneyService } from '../services/storymanagement/ItemJourneyService';
import { createEntityStore } from './createEntityStore';

export const useItemJourneyStore = createEntityStore<'itemJourneys', ItemJourneySelect, ItemJourneyService>({
  collectionKey: 'itemJourneys',
  createService: createItemJourneyService,
  // This service has no filtering support yet - it returns every journey for the story.
  fetchEntities: (service, p) => service.getAllByStoryId(p.storyId),
  defaultSort: 'createdAt',
  persistKey: 'item-journey-storage',
  errorMessages: { fetch: 'Failed to fetch item journeys.' },
});
