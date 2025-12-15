export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'id' | 'color';

export interface EntityFieldMetadata {
  name: string;          // The field name in the entity
  label: string;         // Label for UI display
  type: FieldType;       // Basic type for rendering input components
  isSearchable: boolean; // Whether this field should appear in advanced search
  isSuggestion?: boolean; // Whether to use a suggestion component for this field
  suggestionsSource?: string; // Key to fetch suggestions (e.g., 'genderOptions', 'raceOptions')
}

// Metadata for all entities, grouped by entity name
export const entityFieldMetadata: { [entityName: string]: EntityFieldMetadata[] } = {
  Character: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'title', label: 'field_title', type: 'string', isSearchable: true },
    { name: 'gender', label: 'field_gender', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_gender' },
    { name: 'race', label: 'field_race', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_race' },
    { name: 'subrace', label: 'field_subrace', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_subrace' },
    { name: 'description', label: 'field_description', type: 'string', isSearchable: true },
    { name: 'personality', label: 'field_personality', type: 'string', isSearchable: true },
    { name: 'motivation', label: 'field_motivation', type: 'string', isSearchable: true },
    { name: 'qualities', label: 'field_qualities', type: 'string', isSearchable: true },
    { name: 'weaknesses', label: 'field_weaknesses', type: 'string', isSearchable: true },
    { name: 'biography', label: 'field_biography', type: 'string', isSearchable: true },
    { name: 'plannedTimeline', label: 'field_plannedTimeline', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
    // System fields are generally not searchable directly by users
    // { name: 'id', label: 'ID', type: 'id', isSearchable: false },
    // { name: 'storyId', label: 'Story ID', type: 'id', isSearchable: false },
    // { name: 'createdAt', label: 'Created At', type: 'date', isSearchable: false },
    // { name: 'updatedAt', label: 'Updated At', type: 'date', isSearchable: false },
    // { name: 'version', label: 'Version', type: 'number', isSearchable: false },
    // { name: 'isDeleted', label: 'Is Deleted', type: 'boolean', isSearchable: false },
    // { name: 'deletedAt', label: 'Deleted At', type: 'date', isSearchable: false },
  ],
  Tag: [
    { name: 'name', label: 'field_name', type: 'string', isSearchable: true },
    { name: 'color', label: 'field_color', type: 'color', isSearchable: false }, // Not convenient to do. left here as an what if for the future
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    // { name: 'createdAt', label: 'field_createdAt', type: 'date', isSearchable: false },
    // { name: 'updatedAt', label: 'field_updatedAt', type: 'date', isSearchable: false },
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
    { name: 'isFavorite', label: 'field_isFavorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'field_extraNotes', type: 'string', isSearchable: true },
  ],
  // Add metadata for other entities as needed
};
