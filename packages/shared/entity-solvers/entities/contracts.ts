import type { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityFieldMetadata } from '../../metadata/entityFields';
import type { EntityReference, EntitySolverContext } from '../contracts';

/** Compact, untranslated presentation shared by cards, lists and other entity previews. */
export interface EntityPreview {
  title: string;
  primaryDetail: string | null;
  secondaryDetail: string | null;
}

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
  summarizePreview?: (row: Record<string, unknown>) => EntityPreview;
  advancedSearch?: readonly EntityFieldMetadata[];
  resolveReference?: (context: EntitySolverContext, entityId: string) => Promise<EntityReference>;
  resolveOperationLogName?: (
    context: EntitySolverContext,
    entityId: string,
  ) => Promise<string | undefined>;
}
