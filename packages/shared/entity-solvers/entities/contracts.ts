import type { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityFieldMetadata } from '../../metadata/entityFields';
import type { EntityReference, EntitySolverContext } from '../contracts';
import type { EntityDisplayName } from './displayName';

/** Compact, untranslated presentation shared by cards, lists and other entity previews. */
export interface EntityPreview {
  title: string;
  primaryDetail: string | null;
  secondaryDetail: string | null;
}

export type EntityConflictReference =
  | { kind: 'fixed'; field: string; entityType: OperationLogEntityType }
  | { kind: 'dynamic'; idField: string; typeField: string };

/**
 * Domain presentation owned by one entity. It deliberately contains no database table, SQL, React
 * component or translated prose: hosts supply those concerns through EntitySolverContext.
 */
export interface EntityDomainHandler {
  entityType: OperationLogEntityType;
  help?: {
    source: string;
    fields: readonly string[];
  };
  referenceFields?: Readonly<Record<string, OperationLogEntityType>>;
  conflictLabelKey?: string;
  isConflictRelation?: boolean;
  conflictReferences?: readonly EntityConflictReference[];
  displayName?: EntityDisplayName;
  summarizePreview?: (row: Record<string, unknown>) => EntityPreview;
  advancedSearch?: readonly EntityFieldMetadata[];
  resolveReference?: (context: EntitySolverContext, entityId: string) => Promise<EntityReference>;
  resolveOperationLogName?: (
    context: EntitySolverContext,
    entityId: string,
  ) => Promise<string | undefined>;
}
