import type {
  NoteService,
  NoteWithTags} from '../services/storymanagement/NoteService';
import {
  createNoteService
} from '../services/storymanagement/NoteService';
import { createEntityStore } from './createEntityStore';

export type { FavoriteFilterState } from '../types/entityFilters';

export const useNoteStore = createEntityStore<'notes', NoteWithTags, NoteService>({
  collectionKey: 'notes',
  favoriteEntityType: 'Note',
  createService: createNoteService,
  fetchEntities: (service, p) =>
    service.getNotesByStoryId(
      p.storyId,
      p.searchTerm,
      p.activeFilterTags,
      p.activeSort,
      p.sortDirection,
      p.favoriteFilterState,
      p.advancedSearchCriteria,
    ),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateNote(userId, id, { isFavorite }),
  changeEvent: 'note_changed',
  errorMessages: {
    fetch: 'Failed to load notes.',
    toggleFavorite: 'Failed to update note favorite status.',
  },
});
