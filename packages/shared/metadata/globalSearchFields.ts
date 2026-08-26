/**
 * Config for the Global Search feature (cross-entity free-text search). Deliberately kept
 * separate from `entityFieldMetadata`'s `isSearchable` flag, which drives the per-entity
 * Advanced Search modal (`AdvancedSearchModal`/`GenericFilterSortList`) - reusing it here would
 * silently change which entities show that modal's button (e.g. `Choice` has no entry there
 * today, so its button is correctly disabled).
 *
 * Mirrors `NavigableEntityType` in `apps/client/src/utils/entityNavigation.ts` (same 10 string
 * literals) - shared can't import from client, so the two lists are kept in sync by hand; new
 * entity types are rare and already touch both files.
 */
export type GlobalSearchEntityType =
  | 'Character'
  | 'Scene'
  | 'Location'
  | 'Item'
  | 'ItemJourney'
  | 'Tag'
  | 'Choice'
  | 'Chapter'
  | 'Note'
  | 'WorldRule'
  | 'Mode'
  | 'Plot';

export interface GlobalSearchFieldConfig {
  /** Column used as the result's display title. */
  titleField: string;
  /** String columns to LIKE-match the search term against. */
  searchFields: string[];
}

export const globalSearchFieldConfig: Record<GlobalSearchEntityType, GlobalSearchFieldConfig> = {
  Character: {
    titleField: 'name',
    searchFields: [
      'name',
      'title',
      'gender',
      'race',
      'subrace',
      'description',
      'personality',
      'motivation',
      'qualities',
      'weaknesses',
      'biography',
      'plannedTimeline',
      'extraNotes',
    ],
  },
  Location: {
    titleField: 'name',
    searchFields: ['name', 'description', 'climate', 'culture', 'politics', 'extraNotes'],
  },
  Chapter: {
    titleField: 'name',
    searchFields: ['name', 'summary', 'extraNotes'],
  },
  Scene: {
    titleField: 'name',
    searchFields: ['name', 'summary', 'extraNotes'],
  },
  Choice: {
    titleField: 'text',
    searchFields: ['text'],
  },
  Item: {
    titleField: 'name',
    searchFields: ['name', 'category', 'description', 'initialState', 'extraNotes'],
  },
  ItemJourney: {
    titleField: 'newState',
    searchFields: ['newState', 'extraNotes'],
  },
  Tag: {
    titleField: 'name',
    searchFields: ['name', 'extraNotes'],
  },
  Note: {
    titleField: 'title',
    searchFields: ['title', 'body', 'extraNotes'],
  },
  WorldRule: {
    titleField: 'title',
    searchFields: ['title', 'description', 'extraNotes'],
  },
  // A Mode has no screen of its own: the result carries the owning character's id, and opening it
  // goes to that character's detail, where the modes are listed (see ENTITY_ROUTES in the client).
  Mode: {
    titleField: 'name',
    searchFields: ['name', 'modeChanges'],
  },
  Plot: {
    titleField: 'name',
    searchFields: ['name', 'details'],
  },
};
