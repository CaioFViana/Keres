import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
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

/**
 * Content fields (not those of the 8 relations above) that are IDs of another entity - the same
 * mapping `OperationLogDetailScreen.tsx`'s `REFERENCE_FIELD_ENTITY_TYPES` uses to
 * resolve `EntityService.getEntityIdentifier`. Without this, a genuine conflict on `Scene.chapterId`
 * or `Choice.nextSceneId` showed the raw ID in the field-by-field comparison instead of the name.
 */
const CONTENT_REFERENCE_FIELDS: Record<string, string> = {
  characterId: 'Character',
  character1Id: 'Character',
  character2Id: 'Character',
  characterOwnerId: 'Character',
  newCharacterOwnerId: 'Character',
  sceneId: 'Scene',
  nextSceneId: 'Scene',
  itemId: 'Item',
  locationId: 'Location',
  chapterId: 'Chapter',
  tagId: 'Tag',
  noteId: 'Note',
  worldRuleId: 'WorldRule',
  galleryId: 'Gallery',
  choiceId: 'Choice',
};

/**
 * The entity's name in the synchronization protocol mapped to the already existing translation key.
 * Moved from `SyncConflictModal.tsx` - both the conflict list and the diff drill-in
 * need the same label.
 */
export const ENTITY_LABEL_KEYS: Record<string, string> = {
  Chapter: 'chapter',
  Character: 'character',
  CharacterRelation: 'character_relation',
  CharacterScene: 'character_scene_relation',
  Choice: 'choice',
  Item: 'item',
  ItemJourney: 'item_journey',
  Location: 'location',
  Note: 'note',
  NoteRelation: 'note_relation',
  Scene: 'scene',
  Story: 'story',
  Tag: 'tag',
  TagRelation: 'tag_relation',
  WorldRule: 'world_rule',
  Stat: 'stat',
  StatStrength: 'stat_strength',
  StatRelation: 'stat_relation',
  Mode: 'mode',
};

type RelationFieldTarget =
  /** It always points at the same entity type (e.g. `CharacterScene.characterId` is always a Character). */
  | { kind: 'fixed'; field: string; entityType: string }
  /**
   * A polymorphic pair: the target's type comes from another field's value at runtime
   * (e.g. `GalleryRelation.ownerId` + `ownerType`).
   */
  | { kind: 'dynamic'; idField: string; typeField: string };

/**
 * Which fields of each relation are IDs, and which entity type each one points at - used
 * both to assemble the batch of references to resolve (`collectEntityRefs`) and to assemble
 * each conflict's readable sentence (`buildRelationSummary`). Field names here are those of the
 * synchronization payload (localValues/serverValues of a `PendingConflict`), which are also
 * the local table's column names for every relation.
 */
const RELATION_FIELD_TARGETS: Record<string, RelationFieldTarget[]> = {
  CharacterRelation: [
    { kind: 'fixed', field: 'character1Id', entityType: 'Character' },
    { kind: 'fixed', field: 'character2Id', entityType: 'Character' },
  ],
  TagRelation: [
    { kind: 'fixed', field: 'tagId', entityType: 'Tag' },
    { kind: 'dynamic', idField: 'relationId', typeField: 'relationType' },
  ],
  NoteRelation: [
    { kind: 'fixed', field: 'noteId', entityType: 'Note' },
    { kind: 'dynamic', idField: 'relationId', typeField: 'relationType' },
  ],
  LocationRelation: [
    { kind: 'fixed', field: 'locationAId', entityType: 'Location' },
    { kind: 'fixed', field: 'locationBId', entityType: 'Location' },
  ],
  GalleryRelation: [
    { kind: 'fixed', field: 'galleryId', entityType: 'Gallery' },
    { kind: 'dynamic', idField: 'ownerId', typeField: 'ownerType' },
  ],
  CharacterScene: [
    { kind: 'fixed', field: 'characterId', entityType: 'Character' },
    { kind: 'fixed', field: 'sceneId', entityType: 'Scene' },
  ],
  ItemJourney: [
    { kind: 'fixed', field: 'itemId', entityType: 'Item' },
    { kind: 'fixed', field: 'sceneId', entityType: 'Scene' },
    { kind: 'fixed', field: 'newCharacterOwnerId', entityType: 'Character' },
  ],
  SeeAlsoRelation: [
    { kind: 'dynamic', idField: 'entityAId', typeField: 'entityAType' },
    { kind: 'dynamic', idField: 'entityBId', typeField: 'entityBType' },
  ],
  StatRelation: [
    { kind: 'fixed', field: 'characterId', entityType: 'Character' },
    { kind: 'fixed', field: 'statId', entityType: 'Stat' },
    { kind: 'fixed', field: 'modeId', entityType: 'Mode' },
  ],
};

/**
 * The 8 entity types that are relations/joins: always resolved into a readable line,
 * never into a field-by-field diff table (the original problem that motivated this change).
 */
export const RELATION_ENTITY_TYPES = new Set(Object.keys(RELATION_FIELD_TARGETS));

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
    const targets = RELATION_FIELD_TARGETS[conflict.entityType];
    if (targets) {
      const merged = mergedValuesOf(conflict, snapshots);
      for (const target of targets) {
        if (target.kind === 'fixed') {
          const entityId = merged[target.field];
          if (typeof entityId === 'string' && entityId) {
            refs.push({ entityType: target.entityType, entityId });
          }
        } else {
          const entityId = merged[target.idField];
          const entityType = merged[target.typeField];
          if (
            typeof entityId === 'string' &&
            entityId &&
            typeof entityType === 'string' &&
            entityType
          ) {
            refs.push({ entityType, entityId });
          }
        }
      }
      continue;
    }

    for (const field of conflict.contestedFields) {
      const entityType = CONTENT_REFERENCE_FIELDS[field];
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

  switch (conflict.entityType) {
    case 'CharacterRelation': {
      const a = nameOf(names, 'Character', merged.character1Id, unknown);
      const b = nameOf(names, 'Character', merged.character2Id, unknown);
      return {
        title: t('character_relation'),
        detail: merged.relationType ? `${a} - ${b} (${merged.relationType})` : `${a} - ${b}`,
      };
    }
    case 'TagRelation': {
      const tag = nameOf(names, 'Tag', merged.tagId, unknown);
      const target = nameOf(names, merged.relationType, merged.relationId, unknown);
      return { title: t('tag_relation'), detail: `${tag} - ${target}` };
    }
    case 'NoteRelation': {
      const note = nameOf(names, 'Note', merged.noteId, unknown);
      const target = nameOf(names, merged.relationType, merged.relationId, unknown);
      return { title: t('note_relation'), detail: `${note} - ${target}` };
    }
    case 'LocationRelation': {
      const a = nameOf(names, 'Location', merged.locationAId, unknown);
      const b = nameOf(names, 'Location', merged.locationBId, unknown);
      const detail =
        merged.relationType === 'contains'
          ? t('location_contains_location', { parentName: a, childName: b })
          : t('location_connected_to_location', { locationAName: a, locationBName: b });
      return { title: t('location_relation'), detail };
    }
    case 'GalleryRelation': {
      const gallery = nameOf(names, 'Gallery', merged.galleryId, unknown);
      const owner = nameOf(names, merged.ownerType, merged.ownerId, unknown);
      return { title: t('gallery_relation'), detail: `${gallery} - ${owner}` };
    }
    case 'CharacterScene': {
      const character = nameOf(names, 'Character', merged.characterId, unknown);
      const scene = nameOf(names, 'Scene', merged.sceneId, unknown);
      return { title: t('character_scene_relation'), detail: `${character} - ${scene}` };
    }
    case 'ItemJourney': {
      const item = nameOf(names, 'Item', merged.itemId, unknown);
      const scene = nameOf(names, 'Scene', merged.sceneId, unknown);
      return { title: t('item_journey'), detail: `${item} ${t('showed_in_scene')} ${scene}` };
    }
    case 'SeeAlsoRelation': {
      const a = nameOf(names, merged.entityAType, merged.entityAId, unknown);
      const b = nameOf(names, merged.entityBType, merged.entityBId, unknown);
      return { title: t('see_also_relation'), detail: `${a} - ${b}` };
    }
    case 'StatRelation': {
      const character = nameOf(names, 'Character', merged.characterId, unknown);
      const stat = nameOf(names, 'Stat', merged.statId, unknown);
      const owner = merged.modeId
        ? `${character} · ${nameOf(names, 'Mode', merged.modeId, unknown)}`
        : character;
      const value = merged.value ?? unknown;
      return { title: t('stat_relation'), detail: `${owner} - ${stat}: ${value}` };
    }
    default:
      return {
        title: t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType),
        detail: conflict.entityId,
      };
  }
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
    const entityLabel = t(ENTITY_LABEL_KEYS[conflict.entityType] || conflict.entityType, {
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
        diffFields: [],
      };
    }

    const canQuickResolve = isBinaryContentConflict(conflict);
    const emptyLabel = t('conflict_empty_value');
    // `name`/`title` covers most entities, but not all: Choice has neither of the
    // two (the identifying field is `text`), and Gallery has an optional `title`, falling back to the file
    // name (the same rule `EntityNameBatchResolver.ts` already uses). And neither of the two can
    // come from `localValues`/`serverValues` alone: a `deleted_on_server` conflict does not carry the
    // name on either side (see `mergedValuesOf`) - that is why the local row's snapshot
    // enters as a third level, before falling back to the raw ID.
    const mergedContent = mergedValuesOf(conflict, snapshots);
    const entityName = formatValue(
      mergedContent.name ?? mergedContent.title ?? mergedContent.text ?? mergedContent.fileName,
      conflict.entityId,
    );

    const displayValue = (field: string, value: unknown): string => {
      const targetType = CONTENT_REFERENCE_FIELDS[field];
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
      diffFields,
    };
  });
}
