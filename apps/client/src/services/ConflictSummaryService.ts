import {
  CONFLICT_RELATION_ENTITY_TYPES,
  entityFieldMetadata,
  getEntityConflictLabelKey,
  getEntityRowReferences,
  getSimpleDisplayName,
  resolveEntityReferenceFieldType,
  summarizeEntityConflictRelation,
} from '@keres/shared';
import type { TFunction } from 'i18next';
import type { EntityRef } from './EntityNameBatchResolver';
import type { PendingConflict } from './SyncConflictService';

/** "extraNotes" -> "Extra Notes" - fallback for a field `entityFieldMetadata` doesn't cover.
 *  Same helper as `OperationLogDetailScreen.tsx`'s, duplicated rather than imported since that
 *  file is a screen, not a service this module should depend on. */
function humanizeFieldName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/**
 * The label of a disputed content field. `t(field, {defaultValue: field})` (what the old
 * modal did) only works by coincidence for the few fields that also have a loose translation
 * key without the `field_` prefix (e.g. `motivation`) - `isFavorite` has none, and appeared
 * raw on screen. `entityFieldMetadata` is the real source of truth for each field's label.
 */
function fieldLabel(entityType: string, field: string, t: TFunction): string {
  const meta = entityFieldMetadata[entityType]?.find((f) => f.name === field);
  return meta ? t(meta.label) : humanizeFieldName(field);
}

/** Compatibility export for existing callers; the membership is declared by entity handlers. */
export const RELATION_ENTITY_TYPES: ReadonlySet<string> = CONFLICT_RELATION_ENTITY_TYPES;

export interface ConflictDiffField {
  field: string;
  label: string;
  localDisplay: string;
  serverDisplay: string;
}

export interface ConflictSummary {
  id: string;
  entityType: string;
  kind: 'relation' | 'content';
  /** The entity type's translated label (e.g. "Character"). */
  entityLabel: string;
  /** The row's short title - the relation's type, or the entity's label for content conflicts. */
  title: string;
  /** A readable sentence describing the conflict, with names already resolved - never a raw ID. */
  detail: string;
  reason: PendingConflict['reason'];
  /**
   * When true, the row can be resolved with a button (keep mine/keep the server's) without
   * opening the diff drill-in - either because it is a relation, or because there are no genuinely
   * disputed fields to compare.
   */
  canQuickResolve: boolean;
  /**
   * A Board whose drawing (`content`) clashed: keep-mine / keep-server, plus clone-mine-as-a-new-board.
   * The JSON is not offered field-by-field — two layouts cannot be merged.
   */
  offerBoardClone: boolean;
  /** Only populated for `kind === 'content'` with `canQuickResolve === false`. */
  diffFields: ConflictDiffField[];
}

/** Readable text for any value coming from a synchronization payload. */
function formatValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') {
    return emptyLabel;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Chave de um snapshot no mapa devolvido por `EntitySnapshotResolver.resolveMany`. */
/**
 * Reasons whose ready-made text explains nothing: `validation` and `unknown` only say that the server
 * refused, and the real reason ("a value already exists for this stat in this mode") comes in the
 * message it sent along. Without it the conflict screen is a dead end.
 */
const REASONS_NEEDING_THE_SERVER_MESSAGE = new Set(['validation', 'unknown']);
const SERVER_MESSAGE_MAX_LENGTH = 200;

function withServerMessage(text: string, conflict: PendingConflict): string {
  const message = conflict.message?.trim();
  if (!message || !REASONS_NEEDING_THE_SERVER_MESSAGE.has(conflict.reason)) return text;
  const shortened =
    message.length > SERVER_MESSAGE_MAX_LENGTH
      ? `${message.slice(0, SERVER_MESSAGE_MAX_LENGTH - 1)}…`
      : message;
  return `${text} ${shortened}`;
}

const snapshotKey = (entityType: string, entityId: string) => `${entityType}:${entityId}`;

/**
 * One reference per conflict - its own entity - so as to ask
 * `EntitySnapshotResolver.resolveMany` all at once before assembling the summaries. It has to run first and
 * separately from `collectEntityRefs`: only after having the snapshot is it possible to know, for
 * example, who the two characters of a `CharacterRelation` are whose conflict carries
 * `character1Id`/`character2Id` on neither side (the `deleted_on_server` case).
 */
export function collectConflictEntityRefs(conflicts: PendingConflict[]): EntityRef[] {
  return conflicts.map((conflict) => ({
    entityType: conflict.entityType,
    entityId: conflict.entityId,
  }));
}

/**
 * It joins a conflict's three levels into a single object in order to assemble the sentence: it prefers the
 * local value (what the user did), falls back to the server's on the fields the local operation did not
 * touch, and only last falls back to the current local row's snapshot - necessary because a
 * `deleted_on_server` conflict deliberately carries only `{isDeleted, version}` from the server's
 * side (see `reconcileRemoteUpdate`), so neither a content entity's name nor
 * a relation's IDs are in `localValues`/`serverValues` when the field in question is not
 * the one the user edited offline - only the local row's snapshot (which the remote deletion never
 * got round to erasing) still has that information.
 */
function mergedValuesOf(
  conflict: PendingConflict,
  snapshots: Map<string, Record<string, any>>,
): Record<string, any> {
  const snapshot = snapshots.get(snapshotKey(conflict.entityType, conflict.entityId)) ?? {};
  return { ...snapshot, ...(conflict.serverValues ?? {}), ...conflict.localValues };
}

/**
 * Every entity reference the relation conflicts, plus any content fields
 * that are IDs of another entity, will need to resolve - to be passed all at once to
 * `EntityNameBatchResolver.resolveMany`. It needs the snapshots already resolved (see
 * `collectConflictEntityRefs`) in order to see relation fields that only exist there.
 */
export function collectEntityRefs(
  conflicts: PendingConflict[],
  snapshots: Map<string, Record<string, any>>,
): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const conflict of conflicts) {
    if (RELATION_ENTITY_TYPES.has(conflict.entityType as any)) {
      const merged = mergedValuesOf(conflict, snapshots);
      for (const target of getEntityRowReferences(conflict.entityType, merged)) {
        refs.push({ entityType: target.entityType, entityId: target.id });
      }
      continue;
    }

    for (const field of conflict.contestedFields) {
      const entityType = resolveEntityReferenceFieldType(field);
      if (!entityType) continue;
      const entityId = conflict.localValues[field] ?? conflict.serverValues?.[field];
      if (typeof entityId === 'string' && entityId) {
        refs.push({ entityType, entityId });
      }
    }
  }
  return refs;
}

function nameOf(
  names: Map<string, string>,
  entityType: string | undefined,
  entityId: string | undefined,
  fallback: string,
): string {
  if (!entityType || !entityId) return fallback;
  return names.get(`${entityType}:${entityId}`) || fallback;
}

function buildRelationSummary(
  conflict: PendingConflict,
  snapshots: Map<string, Record<string, any>>,
  names: Map<string, string>,
  t: TFunction,
): { title: string; detail: string } {
  const merged = mergedValuesOf(conflict, snapshots);
  const unknown = t('unknown_entity');
  return (
    summarizeEntityConflictRelation(conflict.entityType, merged, {
      unknown,
      nameOf: (entityType, entityId) =>
        nameOf(names, entityType, typeof entityId === 'string' ? entityId : undefined, unknown),
      translate: (key, values) => t(key, values),
    }) ?? {
      title: t(getEntityConflictLabelKey(conflict.entityType)),
      detail: conflict.entityId,
    }
  );
}

/**
 * The same predicate `SyncConflictModal.tsx` used to decide between the field picker and
 * the binary fallback text - reused here to decide `canQuickResolve`.
 */
function isBinaryContentConflict(conflict: PendingConflict): boolean {
  return (
    conflict.isDeletedOnServer ||
    conflict.isLocalDelete ||
    conflict.serverValues === null ||
    conflict.contestedFields.length === 0
  );
}

export function buildConflictSummaries(
  conflicts: PendingConflict[],
  snapshots: Map<string, Record<string, any>>,
  names: Map<string, string>,
  t: TFunction,
): ConflictSummary[] {
  return conflicts.map((conflict) => {
    const entityLabel = t(getEntityConflictLabelKey(conflict.entityType), {
      defaultValue: conflict.entityType,
    });

    if (RELATION_ENTITY_TYPES.has(conflict.entityType)) {
      const { title, detail } = buildRelationSummary(conflict, snapshots, names, t);
      return {
        id: conflict.id,
        entityType: conflict.entityType,
        kind: 'relation',
        entityLabel,
        title,
        detail: withServerMessage(detail, conflict),
        reason: conflict.reason,
        canQuickResolve: true,
        offerBoardClone: false,
        diffFields: [],
      };
    }

    const offerBoardClone =
      conflict.entityType === 'Board' && conflict.contestedFields.includes('content');
    const canQuickResolve = isBinaryContentConflict(conflict) || offerBoardClone;
    const emptyLabel = t('conflict_empty_value');
    // The entity handler owns its display field and fallback (Choice.text, Gallery.fileName,
    // Effect.triggerName, etc.). A deleted_on_server conflict may carry none of them in either
    // payload, so the local row snapshot remains the final input before falling back to the raw ID.
    const mergedContent = mergedValuesOf(conflict, snapshots);
    const entityName =
      getSimpleDisplayName(conflict.entityType, mergedContent) ?? conflict.entityId;

    const displayValue = (field: string, value: unknown): string => {
      const targetType = resolveEntityReferenceFieldType(field);
      if (targetType && typeof value === 'string' && value) {
        return names.get(`${targetType}:${value}`) || formatValue(value, emptyLabel);
      }
      return formatValue(value, emptyLabel);
    };

    const diffFields: ConflictDiffField[] = canQuickResolve
      ? []
      : conflict.contestedFields.map((field) => ({
          field,
          label: fieldLabel(conflict.entityType, field, t),
          localDisplay: displayValue(field, conflict.localValues[field]),
          serverDisplay: displayValue(field, conflict.serverValues?.[field]),
        }));

    // In the binary case (nothing to compare field by field) the reason explains the decision better
    // than the entity's name alone - the same sentence `SyncConflictModal.tsx` already assembled.
    const detail = canQuickResolve
      ? withServerMessage(
          t(`conflict_reason_${conflict.reason}`, {
            defaultValue: t('conflict_reason_unknown'),
            entity: entityLabel,
          }),
          conflict,
        )
      : entityName;

    return {
      id: conflict.id,
      entityType: conflict.entityType,
      kind: 'content',
      entityLabel,
      title: entityName,
      detail,
      reason: conflict.reason,
      canQuickResolve,
      offerBoardClone,
      diffFields,
    };
  });
}
