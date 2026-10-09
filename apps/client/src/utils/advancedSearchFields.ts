import type { EntityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { StorySchemaFieldSelect } from '../db/schema';
import { buildCustomAttributeFieldMetadata } from './customAttributeFieldMetadata';

/** One kind of entity the list searches by field. A combined list (chapters and scenes) has several. */
export interface AdvancedSearchScope {
  entityName: string;
  /** Keeps two scopes' criteria apart: `scene:name` and `chapter:name`. Empty for a plain list. */
  prefix: string;
  label: string;
}

/** The native fields flagged searchable, then the story's custom attributes - the same set the query reads. */
export function buildSearchFields(
  entityName: string,
  customFields: StorySchemaFieldSelect[],
): EntityFieldMetadata[] {
  return [
    ...(entityFieldMetadata[entityName]?.filter((field) => field.isSearchable) ?? []),
    ...buildCustomAttributeFieldMetadata(customFields),
  ];
}

/** The criteria key a field is stored under for its scope. */
export function criterionKey(scope: AdvancedSearchScope, field: EntityFieldMetadata): string {
  return scope.prefix ? `${scope.prefix}:${field.name}` : field.name;
}

/** A custom field's label is the person's own text; a native one is a translation key. */
export function fieldLabelText(field: EntityFieldMetadata, t: (key: string) => string): string {
  return field.rawLabel ?? t(field.label);
}
