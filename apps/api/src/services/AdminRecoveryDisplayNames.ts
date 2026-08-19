import { getSimpleDisplayName } from '@keres/shared';
import { inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  attributeValues,
  chapters,
  characterRelations,
  characters,
  characterScenes,
  choiceCheckGroups,
  choiceChecks,
  choices,
  comments,
  effects,
  favorites,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  locationRelations,
  locations,
  noteRelations,
  notes,
  scenes,
  seeAlsoRelations,
  stories,
  storySchemaFields,
  suggestions,
  tagRelations,
  tags,
  users,
  worldRules,
} from '../db/schema';

type NameMap = Map<string, string>;

const nameKey = (entityType: string, id: string) => `${entityType}:${id}`;

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function labelOrId(map: NameMap, entityType: string, id: string | null): string {
  if (!id) return '?';
  return map.get(nameKey(entityType, id)) ?? id.slice(0, 8);
}

/** Tables that expose a single primary display column (Gallery handled separately). */
const SIMPLE_TABLES: Partial<
  Record<string, { table: any; column: string }>
> = {
  Character: { table: characters, column: 'name' },
  Location: { table: locations, column: 'name' },
  Item: { table: items, column: 'name' },
  Tag: { table: tags, column: 'name' },
  Scene: { table: scenes, column: 'name' },
  Chapter: { table: chapters, column: 'name' },
  Note: { table: notes, column: 'title' },
  WorldRule: { table: worldRules, column: 'title' },
  Story: { table: stories, column: 'title' },
  Choice: { table: choices, column: 'text' },
  StorySchemaField: { table: storySchemaFields, column: 'name' },
};

async function resolveSimpleNames(refs: Array<{ entityType: string; id: string }>): Promise<NameMap> {
  const idsByType = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!ref.entityType || !ref.id) continue;
    const set = idsByType.get(ref.entityType) ?? new Set<string>();
    set.add(ref.id);
    idsByType.set(ref.entityType, set);
  }

  const result: NameMap = new Map();

  await Promise.all(
    [...idsByType.entries()].map(async ([entityType, ids]) => {
      const idList = [...ids];
      if (entityType === 'Gallery') {
        const rows = await db
          .select({ id: galleries.id, title: galleries.title, fileName: galleries.fileName })
          .from(galleries)
          .where(inArray(galleries.id, idList));
        for (const row of rows) {
          const name = getSimpleDisplayName('Gallery', row as Record<string, unknown>);
          if (name) result.set(nameKey('Gallery', row.id), name);
        }
        return;
      }

      const config = SIMPLE_TABLES[entityType];
      if (!config) return;
      const rows = await db
        .select({ id: config.table.id, name: config.table[config.column] })
        .from(config.table)
        .where(inArray(config.table.id, idList));
      for (const row of rows) {
        if (typeof row.name === 'string' && row.name.trim()) {
          result.set(nameKey(entityType, row.id), row.name.trim());
        }
      }
    }),
  );

  return result;
}

export interface EnrichableDeletedRow {
  entityType: string;
  id: string;
  storyId: string | null;
  name: string | null;
  row: Record<string, unknown>;
}

/**
 * Fills composite labels for relation-like tombstones and returns a storyId → title map.
 * Lookups intentionally include soft-deleted targets (recovery context).
 */
export async function enrichDeletedDisplayNames(
  items: EnrichableDeletedRow[],
): Promise<{ names: Map<string, string | null>; storyTitles: Map<string, string> }> {
  const refs: Array<{ entityType: string; id: string }> = [];
  const groupIdsForChecks = new Set<string>();
  const fieldIds = new Set<string>();
  const storyIds = new Set<string>();

  for (const item of items) {
    if (item.storyId) storyIds.add(item.storyId);
    if (item.entityType === 'Story') storyIds.add(item.id);

    const r = item.row;
    switch (item.entityType) {
      case 'CharacterRelation':
        for (const id of [asId(r.character1Id), asId(r.character2Id)]) {
          if (id) refs.push({ entityType: 'Character', id });
        }
        break;
      case 'LocationRelation':
        for (const id of [asId(r.locationAId), asId(r.locationBId)]) {
          if (id) refs.push({ entityType: 'Location', id });
        }
        break;
      case 'CharacterScene':
        if (asId(r.characterId)) refs.push({ entityType: 'Character', id: r.characterId as string });
        if (asId(r.sceneId)) refs.push({ entityType: 'Scene', id: r.sceneId as string });
        break;
      case 'ItemJourney':
        if (asId(r.itemId)) refs.push({ entityType: 'Item', id: r.itemId as string });
        if (asId(r.sceneId)) refs.push({ entityType: 'Scene', id: r.sceneId as string });
        break;
      case 'TagRelation':
        if (asId(r.tagId)) refs.push({ entityType: 'Tag', id: r.tagId as string });
        if (asId(r.relationId) && asText(r.relationType)) {
          refs.push({ entityType: r.relationType as string, id: r.relationId as string });
        }
        break;
      case 'NoteRelation':
        if (asId(r.noteId)) refs.push({ entityType: 'Note', id: r.noteId as string });
        if (asId(r.relationId) && asText(r.relationType)) {
          refs.push({ entityType: r.relationType as string, id: r.relationId as string });
        }
        break;
      case 'GalleryRelation':
        if (asId(r.galleryId)) refs.push({ entityType: 'Gallery', id: r.galleryId as string });
        if (asId(r.ownerId) && asText(r.ownerType)) {
          refs.push({ entityType: r.ownerType as string, id: r.ownerId as string });
        }
        break;
      case 'SeeAlsoRelation':
        if (asId(r.entityAId) && asText(r.entityAType)) {
          refs.push({ entityType: r.entityAType as string, id: r.entityAId as string });
        }
        if (asId(r.entityBId) && asText(r.entityBType)) {
          refs.push({ entityType: r.entityBType as string, id: r.entityBId as string });
        }
        break;
      case 'Favorite':
        if (asId(r.entityId) && asText(r.entityType)) {
          refs.push({ entityType: r.entityType as string, id: r.entityId as string });
        }
        break;
      case 'Effect':
        if (asId(r.itemId)) refs.push({ entityType: 'Item', id: r.itemId as string });
        break;
      case 'ChoiceCheckGroup':
        if (asId(r.choiceId)) {
          refs.push({ entityType: 'Choice', id: r.choiceId as string });
        }
        break;
      case 'ChoiceCheck':
        if (asId(r.groupId)) groupIdsForChecks.add(r.groupId as string);
        if (asId(r.itemId)) refs.push({ entityType: 'Item', id: r.itemId as string });
        if (asId(r.sceneId)) refs.push({ entityType: 'Scene', id: r.sceneId as string });
        break;
      case 'AttributeValue':
        if (asId(r.fieldId)) fieldIds.add(r.fieldId as string);
        if (asId(r.entityId) && asText(r.entityType)) {
          refs.push({ entityType: r.entityType as string, id: r.entityId as string });
        }
        break;
      default:
        break;
    }
  }

  const groups =
    groupIdsForChecks.size > 0
      ? await db
          .select({ id: choiceCheckGroups.id, choiceId: choiceCheckGroups.choiceId })
          .from(choiceCheckGroups)
          .where(inArray(choiceCheckGroups.id, [...groupIdsForChecks]))
      : [];
  for (const g of groups) {
    refs.push({ entityType: 'Choice', id: g.choiceId });
  }

  const [nameMap, storyRows, fieldRows] = await Promise.all([
    resolveSimpleNames(refs),
    storyIds.size > 0
      ? db
          .select({ id: stories.id, title: stories.title })
          .from(stories)
          .where(inArray(stories.id, [...storyIds]))
      : Promise.resolve([] as Array<{ id: string; title: string }>),
    fieldIds.size > 0
      ? db
          .select({ id: storySchemaFields.id, name: storySchemaFields.name })
          .from(storySchemaFields)
          .where(inArray(storySchemaFields.id, [...fieldIds]))
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);

  const storyTitles = new Map<string, string>();
  for (const row of storyRows) {
    if (row.title?.trim()) storyTitles.set(row.id, row.title.trim());
  }

  const fieldNames = new Map<string, string>();
  for (const row of fieldRows) {
    if (row.name?.trim()) fieldNames.set(row.id, row.name.trim());
  }

  const groupChoiceLabel = new Map<string, string>();
  for (const g of groups) {
    groupChoiceLabel.set(g.id, labelOrId(nameMap, 'Choice', g.choiceId));
  }

  const names = new Map<string, string | null>();

  for (const item of items) {
    const key = nameKey(item.entityType, item.id);
    const r = item.row;
    let composed: string | null = item.name;

    switch (item.entityType) {
      case 'CharacterRelation': {
        const a = labelOrId(nameMap, 'Character', asId(r.character1Id));
        const b = labelOrId(nameMap, 'Character', asId(r.character2Id));
        const type = asText(r.relationType);
        composed = type ? `${a} ↔ ${b} · ${type}` : `${a} ↔ ${b}`;
        break;
      }
      case 'LocationRelation': {
        const a = labelOrId(nameMap, 'Location', asId(r.locationAId));
        const b = labelOrId(nameMap, 'Location', asId(r.locationBId));
        const type = asText(r.relationType);
        composed = type ? `${a} → ${b} · ${type}` : `${a} → ${b}`;
        break;
      }
      case 'CharacterScene': {
        composed = `${labelOrId(nameMap, 'Character', asId(r.characterId))} @ ${labelOrId(nameMap, 'Scene', asId(r.sceneId))}`;
        break;
      }
      case 'ItemJourney': {
        composed = `${labelOrId(nameMap, 'Item', asId(r.itemId))} @ ${labelOrId(nameMap, 'Scene', asId(r.sceneId))}`;
        break;
      }
      case 'TagRelation': {
        const tag = labelOrId(nameMap, 'Tag', asId(r.tagId));
        const targetType = asText(r.relationType) ?? '?';
        const target = labelOrId(nameMap, targetType, asId(r.relationId));
        composed = `#${tag} → ${targetType}:${target}`;
        break;
      }
      case 'NoteRelation': {
        const note = labelOrId(nameMap, 'Note', asId(r.noteId));
        const targetType = asText(r.relationType) ?? '?';
        const target = labelOrId(nameMap, targetType, asId(r.relationId));
        composed = `${note} → ${targetType}:${target}`;
        break;
      }
      case 'GalleryRelation': {
        const gallery = labelOrId(nameMap, 'Gallery', asId(r.galleryId));
        const ownerType = asText(r.ownerType) ?? '?';
        const owner = labelOrId(nameMap, ownerType, asId(r.ownerId));
        composed = `${gallery} → ${ownerType}:${owner}`;
        break;
      }
      case 'SeeAlsoRelation': {
        const aType = asText(r.entityAType) ?? '?';
        const bType = asText(r.entityBType) ?? '?';
        composed = `${labelOrId(nameMap, aType, asId(r.entityAId))} ↔ ${labelOrId(nameMap, bType, asId(r.entityBId))}`;
        break;
      }
      case 'Favorite': {
        const targetType = asText(r.entityType) ?? '?';
        composed = `★ ${targetType}:${labelOrId(nameMap, targetType, asId(r.entityId))}`;
        break;
      }
      case 'Effect': {
        const effectType = asText(r.effectType) ?? 'effect';
        const itemName = asId(r.itemId) ? labelOrId(nameMap, 'Item', asId(r.itemId)) : null;
        const trigger = asText(r.triggerName);
        composed = itemName
          ? `${effectType}: ${itemName}`
          : trigger
            ? `${effectType}: ${trigger}`
            : effectType;
        break;
      }
      case 'ChoiceCheckGroup': {
        composed = `checks · ${labelOrId(nameMap, 'Choice', asId(r.choiceId))}`;
        break;
      }
      case 'ChoiceCheck': {
        const groupId = asId(r.groupId);
        const choiceLabel = groupId ? groupChoiceLabel.get(groupId) : null;
        const mode = asText(r.mode);
        const type = asText(r.type);
        composed = [choiceLabel, mode, type].filter(Boolean).join(' · ') || item.name;
        break;
      }
      case 'AttributeValue': {
        const fieldId = asId(r.fieldId);
        const fieldName = fieldId ? fieldNames.get(fieldId) : null;
        const value = asText(r.value) ?? '(empty)';
        composed = fieldName ? `${fieldName}=${value}` : value;
        break;
      }
      default:
        break;
    }

    names.set(key, composed);
  }

  return { names, storyTitles };
}

const ENTITY_TABLES: Partial<Record<string, any>> = {
  Character: characters,
  Location: locations,
  Item: items,
  Tag: tags,
  Scene: scenes,
  Chapter: chapters,
  Note: notes,
  WorldRule: worldRules,
  Story: stories,
  Choice: choices,
  StorySchemaField: storySchemaFields,
  Suggestion: suggestions,
  Gallery: galleries,
  Comment: comments,
  Effect: effects,
  Favorite: favorites,
  AttributeValue: attributeValues,
  CharacterRelation: characterRelations,
  LocationRelation: locationRelations,
  CharacterScene: characterScenes,
  ItemJourney: itemJourneys,
  TagRelation: tagRelations,
  NoteRelation: noteRelations,
  GalleryRelation: galleryRelations,
  SeeAlsoRelation: seeAlsoRelations,
  ChoiceCheckGroup: choiceCheckGroups,
  ChoiceCheck: choiceChecks,
};

function payloadAsRow(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

async function loadEntityRows(
  refs: Array<{ entityType: string; id: string }>,
): Promise<Map<string, Record<string, unknown>>> {
  const idsByType = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!ref.entityType || !ref.id) continue;
    const set = idsByType.get(ref.entityType) ?? new Set<string>();
    set.add(ref.id);
    idsByType.set(ref.entityType, set);
  }

  const result = new Map<string, Record<string, unknown>>();
  await Promise.all(
    [...idsByType.entries()].map(async ([entityType, ids]) => {
      const table = ENTITY_TABLES[entityType];
      if (!table) return;
      const rows = await db.select().from(table).where(inArray(table.id, [...ids]));
      for (const row of rows as Array<{ id: string }>) {
        result.set(nameKey(entityType, row.id), row as unknown as Record<string, unknown>);
      }
    }),
  );
  return result;
}

export interface OperationLogNameSource {
  id: string;
  entityType: string;
  entityId: string;
  storyId: string;
  userId: string;
  payload: unknown;
}

export interface OperationLogNameEnrichment {
  entityName: string | null;
  storyTitle: string | null;
  username: string | null;
}

/**
 * Same display-name pipeline as deleted-items, using the log payload plus the current
 * (possibly tombstoned) entity row so deletes still resolve.
 */
export async function enrichOperationLogNames(
  entries: OperationLogNameSource[],
): Promise<Map<string, OperationLogNameEnrichment>> {
  const refs = entries.map((e) => ({ entityType: e.entityType, id: e.entityId }));
  const [dbRows, usernames] = await Promise.all([
    loadEntityRows(refs),
    (async () => {
      const ids = [...new Set(entries.map((e) => e.userId).filter(Boolean))];
      const map = new Map<string, string>();
      if (ids.length === 0) return map;
      const rows = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, ids));
      for (const row of rows) map.set(row.id, row.username);
      return map;
    })(),
  ]);

  const enrichable: EnrichableDeletedRow[] = entries.map((entry) => {
    const key = nameKey(entry.entityType, entry.entityId);
    const row = { ...(dbRows.get(key) ?? {}), ...payloadAsRow(entry.payload) };
    return {
      entityType: entry.entityType,
      id: entry.entityId,
      storyId: entry.storyId,
      name: getSimpleDisplayName(entry.entityType, row),
      row,
    };
  });

  const { names, storyTitles } = await enrichDeletedDisplayNames(enrichable);
  const result = new Map<string, OperationLogNameEnrichment>();
  for (const entry of entries) {
    const key = nameKey(entry.entityType, entry.entityId);
    result.set(entry.id, {
      entityName:
        names.get(key) ?? getSimpleDisplayName(entry.entityType, payloadAsRow(entry.payload)),
      storyTitle: storyTitles.get(entry.storyId) ?? null,
      username: usernames.get(entry.userId) ?? null,
    });
  }
  return result;
}
