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

/** Dependencies supplied by a host after it batch-resolves relation participants. */
export interface EntityConflictRelationSummaryContext {
  /** Returns a readable participant name or the host's localized unknown-entity fallback. */
  nameOf: (entityType: string | undefined, entityId: unknown) => string;
  /** Keeps translation in the host while the entity owns the relation's composition. */
  translate: (key: string, values?: Record<string, unknown>) => string;
  unknown: string;
}

/** Compact, host-translated presentation for a conflicting relation row. */
export interface EntityConflictRelationSummary {
  title: string;
  detail: string;
}

/** A same-story foreign key represented in a portable story export. */
export interface EntityExportReference {
  field: string;
  targetEntityType: OperationLogEntityType;
  required: boolean;
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
  conflictLabelKey?: string;
  isConflictRelation?: boolean;
  conflictReferences?: readonly EntityConflictReference[];
  /**
   * Explains a relation conflict after the host has loaded its referenced entity names in bulk.
   * It contains no persistence access, React component, or concrete i18n implementation.
   */
  summarizeConflictRelation?: (
    row: Record<string, unknown>,
    context: EntityConflictRelationSummaryContext,
  ) => EntityConflictRelationSummary;
  exportCollection?: string;
  exportReferences?: readonly EntityExportReference[];
  /**
   * User and operation-log records participate in the vocabulary but are not children of a story.
   * Every other domain handler is synchronized with the story unless it opts out explicitly.
   */
  syncable?: boolean;
  displayName?: EntityDisplayName;
  summarizePreview?: (row: Record<string, unknown>) => EntityPreview;
  advancedSearch?: readonly EntityFieldMetadata[];
  resolveReference?: (context: EntitySolverContext, entityId: string) => Promise<EntityReference>;
  resolveOperationLogName?: (
    context: EntitySolverContext,
    entityId: string,
  ) => Promise<string | undefined>;
  /**
   * Short, untranslated label for dense host UIs such as recovery lists. Relations resolve their
   * own referenced entities here; hosts only provide a read-through context.
   */
  resolveCompactName?: (
    context: EntitySolverContext,
    entityId: string,
  ) => Promise<string | undefined>;
}
