export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'id';

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
    { name: 'name', label: 'Name', type: 'string', isSearchable: true },
    { name: 'title', label: 'Title', type: 'string', isSearchable: true },
    { name: 'gender', label: 'Gender', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_gender' },
    { name: 'race', label: 'Race', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_race' },
    { name: 'subrace', label: 'Subrace', type: 'string', isSearchable: true, isSuggestion: true, suggestionsSource: 'character_subrace' },
    { name: 'description', label: 'Description', type: 'string', isSearchable: true },
    { name: 'personality', label: 'Personality', type: 'string', isSearchable: true },
    { name: 'motivation', label: 'Motivation', type: 'string', isSearchable: true },
    { name: 'qualities', label: 'Qualities', type: 'string', isSearchable: true },
    { name: 'weaknesses', label: 'Weaknesses', type: 'string', isSearchable: true },
    { name: 'biography', label: 'Biography', type: 'string', isSearchable: true },
    { name: 'plannedTimeline', label: 'Planned Timeline', type: 'string', isSearchable: true },
    { name: 'isFavorite', label: 'Is Favorite', type: 'boolean', isSearchable: true },
    { name: 'extraNotes', label: 'Extra Notes', type: 'string', isSearchable: true },
    // System fields are generally not searchable directly by users
    // { name: 'id', label: 'ID', type: 'id', isSearchable: false },
    // { name: 'storyId', label: 'Story ID', type: 'id', isSearchable: false },
    // { name: 'createdAt', label: 'Created At', type: 'date', isSearchable: false },
    // { name: 'updatedAt', label: 'Updated At', type: 'date', isSearchable: false },
    // { name: 'version', label: 'Version', type: 'number', isSearchable: false },
    // { name: 'isDeleted', label: 'Is Deleted', type: 'boolean', isSearchable: false },
    // { name: 'deletedAt', label: 'Deleted At', type: 'date', isSearchable: false },
  ],
  // Add metadata for other entities as needed
};
