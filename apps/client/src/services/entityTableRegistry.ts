import { getTableColumns } from 'drizzle-orm';
import * as schema from '../db/schema';

/**
 * A map from entity name (the same one used in the operation log and in the
 * synchronization protocol) to the corresponding local table.
 *
 * It exists because conflict resolution needs to write to an entity chosen at
 * runtime: the screen knows the conflict is a `'Chapter'` one, but it cannot
 * import the chapters table statically without repeating that switch in every path.
 */
export const ENTITY_TABLES = {
  Board: schema.boards,
  Chapter: schema.chapters,
  Character: schema.characters,
  ChapterAnchor: schema.chapterAnchors,
  CharacterRelation: schema.characterRelations,
  CharacterScene: schema.characterScenes,
  Choice: schema.choices,
  Gallery: schema.galleries,
  GalleryRelation: schema.galleryRelations,
  Item: schema.items,
  ItemJourney: schema.itemJourneys,
  Location: schema.locations,
  LocationMap: schema.locationMaps,
  Mode: schema.modes,
  LocationRelation: schema.locationRelations,
  Note: schema.notes,
  NoteRelation: schema.noteRelations,
  Plot: schema.plots,
  PlotScene: schema.plotScenes,
  Route: schema.routes,
  RouteStep: schema.routeSteps,
  Scene: schema.scenes,
  Stat: schema.stats,
  StatRelation: schema.statRelations,
  StatStrength: schema.statStrengths,
  SeeAlsoRelation: schema.seeAlsoRelations,
  Story: schema.stories,
  Suggestion: schema.suggestions,
  Tag: schema.tags,
  TagRelation: schema.tagRelations,
  StoryCalendar: schema.storyCalendars,
  WorldRule: schema.worldRules,
} as const;

export type SyncableEntityName = keyof typeof ENTITY_TABLES;

export function getEntityTable(entityType: string) {
  return (ENTITY_TABLES as Record<string, (typeof ENTITY_TABLES)[SyncableEntityName] | undefined>)[
    entityType
  ];
}

/** Campos de data: chegam como string no JSON e as tabelas locais esperam `Date`. */
const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'deletedAt']);

/**
 * Fields that must never be overwritten from an external payload, because they are the row's
 * identity or are administered by the synchronization engine itself.
 */
const PROTECTED_FIELDS = new Set([
  'id',
  'storyId',
  'serverId',
  'lastOperationLog',
  'lastServerSyncedLog',
  'lastPublicFavoriteLog',
  'myRole',
]);

const PROTECTED_BY_ENTITY: Record<string, ReadonlySet<string>> = {
  Story: new Set(['userId']),
};

/**
 * Normalizes an object coming from JSON into something drizzle accepts in a `.set()`:
 * it converts dates, discards protected fields and ignores keys that do not exist in the table.
 */
export function toEntityColumns(
  entityType: string,
  values: Record<string, any>,
): Record<string, any> {
  const table = getEntityTable(entityType);
  if (!table) {
    return {};
  }

  const columns = new Set(Object.keys(getTableColumns(table)));
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(values)) {
    if (
      PROTECTED_FIELDS.has(key) ||
      PROTECTED_BY_ENTITY[entityType]?.has(key) ||
      !columns.has(key)
    ) {
      continue;
    }
    if (DATE_FIELDS.has(key)) {
      normalized[key] = value ? new Date(value) : null;
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

/** It discards local bookkeeping columns even when the entity is not in the registry. */
export function omitClientProtectedFields(
  entityType: string,
  payload: Record<string, any> | undefined,
): Record<string, any> {
  const out: Record<string, any> = { ...(payload ?? {}) };
  for (const key of PROTECTED_FIELDS) {
    delete out[key];
  }
  for (const key of PROTECTED_BY_ENTITY[entityType] ?? []) {
    delete out[key];
  }
  return out;
}
