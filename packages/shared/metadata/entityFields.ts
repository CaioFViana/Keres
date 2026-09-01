export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  /** A date in the story's own calendar, held as a day number. See `AttributeType.STORY_DATE`. */
  | 'story_date'
  | 'id'
  | 'color'
  | 'entity';

export interface EntityFieldMetadata {
  name: string; // The field name in the entity
  label: string; // Translation key for UI display (ignored when `rawLabel` is set)
  type: FieldType; // Basic type for rendering input components
  isSearchable: boolean; // Whether this field should appear in advanced search
  isSuggestion?: boolean; // Whether to use a suggestion component for this field
  suggestionsSource?: string; // Key to fetch suggestions (e.g., 'genderOptions', 'raceOptions')
  /** Fixed target type when `type` is `entity`. */
  entityTargetType?: string | null;
  /** Already-resolved display text, used as-is instead of `t(label)` - for synthetic metadata
   *  built from user-defined data (Story Schema custom attributes) that has no translation key,
   *  see `apps/client/src/utils/customAttributeFieldMetadata.ts`. */
  rawLabel?: string;
}

// Metadata for all entities, grouped by entity name
export const entityFieldMetadata: { [entityName: string]: EntityFieldMetadata[] } = {
  Character: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'title', label: 'field_title', type: 'string', isSearchable: true },
    {
      name: 'gender',
      label: 'field_gender',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'character_gender',
    },
    {
      name: 'race',
      label: 'field_race',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'character_race',
    },
    {
      name: 'subrace',
      label: 'field_subrace',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'character_subrace',
    },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
    { name: 'personality', label: 'field_personality', type: 'string', isSearchable: true },
    { name: 'motivation', label: 'field_motivation', type: 'string', isSearchable: true },
    { name: 'qualities', label: 'field_qualities', type: 'string', isSearchable: true },
    { name: 'weaknesses', label: 'field_weaknesses', type: 'string', isSearchable: true },
    { name: 'biography', label: 'field_biography', type: 'string', isSearchable: true },
    { name: 'plannedTimeline', label: 'field_plannedTimeline', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
    // Virtual field: CharacterService resolves it through either endpoint of a relation.
    {
      name: 'relationType',
      label: 'field_relationType',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'characterRelation_type',
    },
    // System fields are generally not searchable directly by users
    // Like id, storyId, createdAt, updatedAt, version, isDeleted, deletedAt
  ],
  Tag: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'color', label: 'field_color', type: 'color', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
  ],
  Note: [
    { name: 'title', label: 'field_title', type: 'string', isSearchable: true },
    { name: 'body', label: 'field_body', type: 'string', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
  ],
  WorldRule: [
    { name: 'title', label: 'field_title', type: 'string', isSearchable: true },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
    // The World index already scopes a list to one Section. Keeping it out of Advanced Search
    // avoids a redundant free-text control which cannot express this fixed enum precisely.
    { name: 'section', label: 'world_piece_section', type: 'string', isSearchable: false },
    { name: 'type', label: 'world_piece_type', type: 'string', isSearchable: true },
    { name: 'category', label: 'category', type: 'string', isSearchable: true },
    { name: 'behavior', label: 'world_piece_behavior', type: 'string', isSearchable: true },
    { name: 'usability', label: 'world_piece_usability', type: 'string', isSearchable: true },
    { name: 'danger', label: 'world_piece_danger', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  Board: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
  ],
  Plot: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'details', label: 'field_details', type: 'string', isSearchable: true },
  ],
  Route: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'details', label: 'field_details', type: 'string', isSearchable: true },
  ],
  Mode: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'modeChanges', label: 'field_modeChanges', type: 'string', isSearchable: true },
  ],
  CharacterRelation: [
    {
      name: 'relationType',
      label: 'field_relationType',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'characterRelation_type',
    },
  ],
  Location: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
    { name: 'climate', label: 'field_climate', type: 'string', isSearchable: true },
    { name: 'culture', label: 'field_culture', type: 'string', isSearchable: true },
    { name: 'politics', label: 'field_politics', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  Item: [
    { name: 'name', label: 'item_name', type: 'string', isSearchable: true },
    {
      name: 'category',
      label: 'category',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'item_category',
    },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
    {
      name: 'initialState',
      label: 'initial_state',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'item_initial_state',
    },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  ItemJourney: [
    { name: 'itemId', label: 'item', type: 'id', isSearchable: true },
    { name: 'sceneId', label: 'scene', type: 'id', isSearchable: true },
    { name: 'newCharacterOwnerId', label: 'new_character_owner', type: 'id', isSearchable: true },
    {
      name: 'newState',
      label: 'new_state',
      type: 'string',
      isSearchable: true,
      isSuggestion: true,
      suggestionsSource: 'item_state',
    },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  Chapter: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'summary', label: 'summary', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  Scene: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'summary', label: 'summary', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  Choice: [
    { name: 'text', label: 'text', type: 'string', isSearchable: true },
    {
      name: 'choiceSearch',
      label: 'choice_text_or_notes',
      type: 'string',
      isSearchable: true,
    },
  ],
  // Add other relevant entities as needed
};
