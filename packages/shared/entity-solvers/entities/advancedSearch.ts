import type { EntityFieldMetadata, FieldType } from '../../metadata/entityFields';

type SearchOptions = Pick<
  EntityFieldMetadata,
  'isSuggestion' | 'suggestionsSource' | 'entityTargetType'
>;

/** Small constructors keep each entity's search surface next to its handler without duplicating shape. */
export const searchField = (
  name: string,
  label: string,
  type: FieldType = 'string',
  options: SearchOptions = {},
): EntityFieldMetadata => ({ name, label, type, isSearchable: true, ...options });

export const nonSearchableField = (
  name: string,
  label: string,
  type: FieldType = 'string',
): EntityFieldMetadata => ({ name, label, type, isSearchable: false });
