import { getEntityDomainHandler } from '../entity-solvers/entities/EntityRegistry';
import { OperationLogEntityType } from './OperationLogEntityType';

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
  name: string;
  label: string;
  type: FieldType;
  isSearchable: boolean;
  isSuggestion?: boolean;
  suggestionsSource?: string;
  entityTargetType?: string | null;
  rawLabel?: string;
}

/**
 * Compatibility view for existing search components. Search metadata belongs to the respective
 * entity handlers; this facade only indexes the handlers by their persisted entity type.
 */
export const entityFieldMetadata: Record<string, EntityFieldMetadata[]> = Object.fromEntries(
  Object.values(OperationLogEntityType).flatMap((entityType) => {
    const fields = getEntityDomainHandler(entityType)?.advancedSearch;
    return fields ? [[entityType, [...fields]]] : [];
  }),
);
