import type { FavoriteEntityType } from '@keres/shared';
import {
  AttributeType,
  decodeAttributeValue,
  excerptAroundMatch,
  joinSuggestionListForDisplay,
} from '@keres/shared';
import type { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import type { SQL } from 'drizzle-orm';
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import { attributeValues, chapters, scenes, storySchemaFields } from '../../db/schema';
import { columnsOf, getEntityTable } from '../entityTableRegistry';
import type { OccurrenceTarget } from '../../utils/occurrenceTarget';
import { truncate } from '../../utils/stringUtils';
import { createFavoriteService } from './FavoriteService';
import { createStoryArcService } from './StoryArcService';

export interface GlobalSearchResult {
  entityType: GlobalSearchEntityType;
  id: string;
  title: string;
  snippet: string;
  /** Caminho contextual para resultados que vivem dentro de outra entidade, como Scene. */
  context?: string;
  /** `null` marks entity types that do not support favorites. */
  isFavorite: boolean | null;
  /**
   * The first match, for detail screens to land on. Absent when the match is the
   * title itself (the header is already at the top) or a Mode (its owner's list).
   */
  occurrence?: OccurrenceTarget;
  /**
   * The work(s) the result belongs to, said only when the story has more than one: a global search
   * looks everywhere, so each result names where it is.
   */
  arcTitle?: string;
}

export interface GlobalSearchService {
  searchAllEntities(
    storyId: string,
    term: string,
    localUserId: string,
  ): Promise<GlobalSearchResult[]>;
}

const NATIVE_RESULT_LIMIT_PER_ENTITY = 15;
const ATTRIBUTE_RESULT_LIMIT = 50;
const SNIPPET_MAX_LENGTH = 120;

const MIN_SEARCH_TERM_LENGTH = 2;

const ENTITY_TYPES = Object.keys(globalSearchFieldConfig) as GlobalSearchEntityType[];
const FAVORITABLE_ENTITY_TYPES = new Set<GlobalSearchEntityType>([
  'Character',
  'Location',
  'Chapter',
  'Scene',
  'Item',
  'Tag',
  'Note',
  'WorldRule',
]);

function formatAttributeSearchValue(type: string, stored: string | null | undefined): string {
  if (type !== AttributeType.SUGGESTION_LIST) {
    return stored ?? '';
  }
  const decoded = decodeAttributeValue(AttributeType.SUGGESTION_LIST, stored);
  return joinSuggestionListForDisplay(Array.isArray(decoded) ? decoded : null) ?? stored ?? '';
}

/**
 * `label: …match context…`, framed around the first hit like backlinks. Falls back
 * to a head truncation when display formatting (booleans, spelled-out dates) no
 * longer contains the term that matched storage.
 */
function buildSnippet(fieldLabel: string, displayValue: string, term: string): string {
  const available = Math.max(40, SNIPPET_MAX_LENGTH - fieldLabel.length - 2);
  const at = displayValue.toLowerCase().indexOf(term.toLowerCase());
  const framed =
    at === -1
      ? truncate(displayValue, available)
      : excerptAroundMatch(displayValue, { start: at, length: term.length }, available);
  return `${fieldLabel}: ${framed}`;
}

/** First configured search field whose value actually contains `term` (case-insensitive) - used to pick which field to show in the snippet. */
function findMatchingField(
  row: Record<string, unknown>,
  searchFields: string[],
  term: string,
): { field: string; value: string } | null {
  const lowerTerm = term.toLowerCase();
  for (const field of searchFields) {
    const value = row[field];
    if (typeof value === 'string' && value.toLowerCase().includes(lowerTerm)) {
      return { field, value };
    }
  }
  return null;
}

/**
 * Names, on each result, the work it belongs to: a chapter by its own, a scene by its chapter's, and
 * a character, place or item by the works of the scenes it appears in. Nothing is said in a story with
 * a single work - there is nothing to tell apart.
 */
async function labelResultsWithArcs(
  db: AppDrizzleClient,
  storyId: string,
  found: GlobalSearchResult[],
): Promise<void> {
  if (found.length === 0) return;
  const arcService = createStoryArcService(db);
  const arcs = (await arcService.getArcsForStory(storyId)).filter((arc) => !arc.isDeleted);
  if (arcs.length < 2) return;
  const titles = new Map(arcs.map((arc) => [arc.id, arc.title]));
  const label = (ids: (string | null | undefined)[] | undefined) => {
    const names = [...new Set((ids ?? []).flatMap((id) => (id ? [titles.get(id)] : [])))].filter(
      (name): name is string => !!name,
    );
    return names.length > 0 ? names.join(', ') : undefined;
  };

  const idsOf = (entityType: GlobalSearchEntityType) =>
    found.filter((result) => result.entityType === entityType).map((result) => result.id);
  const chapterIds = idsOf('Chapter');
  if (chapterIds.length > 0) {
    const rows = await db
      .select({ id: chapters.id, arcId: chapters.arcId })
      .from(chapters)
      .where(inArray(chapters.id, chapterIds))
      .all();
    const byId = new Map(rows.map((row) => [row.id, row.arcId]));
    for (const result of found) {
      if (result.entityType === 'Chapter') result.arcTitle = label([byId.get(result.id)]);
    }
  }
  const sceneIds = idsOf('Scene');
  if (sceneIds.length > 0) {
    const rows = await db
      .select({ id: scenes.id, arcId: chapters.arcId })
      .from(scenes)
      .innerJoin(chapters, eq(scenes.chapterId, chapters.id))
      .where(inArray(scenes.id, sceneIds))
      .all();
    const byId = new Map(rows.map((row) => [row.id, row.arcId]));
    for (const result of found) {
      if (result.entityType === 'Scene') result.arcTitle = label([byId.get(result.id)]);
    }
  }
  for (const [entityType, kind] of [
    ['Character', 'character'],
    ['Location', 'location'],
    ['Item', 'item'],
  ] as const) {
    if (idsOf(entityType).length === 0) continue;
    const arcIdsByEntity = await arcService.listEntityArcIds(storyId, kind);
    for (const result of found) {
      if (result.entityType === entityType) result.arcTitle = label(arcIdsByEntity.get(result.id));
    }
  }
}

export const createGlobalSearchService = (db: AppDrizzleClient): GlobalSearchService => {
  return {
    async searchAllEntities(
      storyId: string,
      term: string,
      localUserId: string,
    ): Promise<GlobalSearchResult[]> {
      const trimmedTerm = term.trim();
      if (trimmedTerm.length < MIN_SEARCH_TERM_LENGTH) {
        return [];
      }

      const results = new Map<string, GlobalSearchResult>();

      // Native fields - one query per entity type, run in parallel.
      const nativeQueries = ENTITY_TYPES.map(async (entityType) => {
        const { titleField, searchFields } = globalSearchFieldConfig[entityType];
        const table = getEntityTable(entityType);
        if (!table) return;

        const rows = await db
          .select()
          .from(table)
          .where(
            and(
              eq(columnsOf(table).storyId, storyId),
              eq(columnsOf(table).isDeleted, false),
              or(
                ...searchFields.map(
                  (field) =>
                    sql`${columnsOf(table)[field]} LIKE ${`%${trimmedTerm}%`} COLLATE NOCASE` as SQL<boolean>,
                ),
              ),
            ),
          )
          .limit(NATIVE_RESULT_LIMIT_PER_ENTITY)
          .all();

        for (const row of rows as Record<string, unknown>[]) {
          const match = findMatchingField(row, searchFields, trimmedTerm);
          // A Mode has no screen of its own: the result carries the owning character's id, which is where
          // `navigateToEntityDetail` goes (see ENTITY_ROUTES.Mode in entityNavigation).
          // Both id columns are NOT NULL, so the String is only the type narrowing.
          const resultId = String(entityType === 'Mode' ? row.characterId : row.id);
          const key = `${entityType}:${row.id}`;
          // Title matches land on top (the header); Modes land on the owner's list.
          const occurrence =
            match && entityType !== 'Mode' && match.field !== titleField
              ? { field: match.field, needle: trimmedTerm }
              : undefined;
          results.set(key, {
            entityType,
            id: resultId,
            title: String(row[titleField] ?? ''),
            snippet: match ? buildSnippet(match.field, String(match.value), trimmedTerm) : '',
            isFavorite: null,
            occurrence,
          });
        }
      });

      // Custom Story Schema attributes - one query across every entity type at once.
      const attributeQuery = (async () => {
        const rows = await db
          .select({ attribute: attributeValues, field: storySchemaFields })
          .from(attributeValues)
          .innerJoin(storySchemaFields, eq(attributeValues.fieldId, storySchemaFields.id))
          .where(
            and(
              eq(attributeValues.storyId, storyId),
              eq(attributeValues.isDeleted, false),
              ne(storySchemaFields.type, AttributeType.ENTITY),
              sql`${attributeValues.value} LIKE ${`%${trimmedTerm}%`} COLLATE NOCASE` as SQL<boolean>,
            ),
          )
          .limit(ATTRIBUTE_RESULT_LIMIT)
          .all();

        const idsByEntityType = new Map<GlobalSearchEntityType, Set<string>>();
        for (const row of rows) {
          const entityType = row.attribute.entityType as GlobalSearchEntityType;
          if (!globalSearchFieldConfig[entityType]) continue;
          if (!idsByEntityType.has(entityType)) idsByEntityType.set(entityType, new Set());
          idsByEntityType.get(entityType)!.add(row.attribute.entityId);
        }

        const titlesByEntityKey = new Map<string, string>();
        await Promise.all(
          Array.from(idsByEntityType.entries()).map(async ([entityType, idSet]) => {
            const table = getEntityTable(entityType);
            if (!table) return;
            const { titleField } = globalSearchFieldConfig[entityType];
            const titleRows = await db
              .select({ id: columnsOf(table).id, title: columnsOf(table)[titleField] })
              .from(table)
              .where(
                and(
                  inArray(columnsOf(table).id, Array.from(idSet)),
                  eq(columnsOf(table).isDeleted, false),
                ),
              )
              .all();
            for (const titleRow of titleRows as { id: string; title: unknown }[]) {
              titlesByEntityKey.set(`${entityType}:${titleRow.id}`, String(titleRow.title ?? ''));
            }
          }),
        );

        for (const row of rows) {
          const entityType = row.attribute.entityType as GlobalSearchEntityType;
          if (!globalSearchFieldConfig[entityType]) continue;
          const key = `${entityType}:${row.attribute.entityId}`;
          if (results.has(key)) continue; // Native field match already covers this entity.
          const title = titlesByEntityKey.get(key);
          if (title === undefined) continue; // Entity was deleted/not found.
          const displayValue = formatAttributeSearchValue(row.field.type, row.attribute.value);
          results.set(key, {
            entityType,
            id: row.attribute.entityId,
            title,
            snippet: buildSnippet(row.field.name, displayValue, trimmedTerm),
            isFavorite: null,
            occurrence: { field: `custom:${row.attribute.fieldId}`, needle: trimmedTerm },
          });
        }
      })();

      // Entity attributes are searched by their referenced entity's title, never by the raw
      // ULID stored in AttributeValue.value. Skip all of this work for stories without one.
      const entityAttributeQuery = (async () => {
        const entityFields = await db
          .select({
            id: storySchemaFields.id,
            name: storySchemaFields.name,
            targetEntityType: storySchemaFields.targetEntityType,
          })
          .from(storySchemaFields)
          .where(
            and(
              eq(storySchemaFields.storyId, storyId),
              eq(storySchemaFields.type, AttributeType.ENTITY),
              eq(storySchemaFields.isDeleted, false),
            ),
          )
          .all();

        const fieldsByTarget = new Map<GlobalSearchEntityType, typeof entityFields>();
        for (const field of entityFields) {
          const target = field.targetEntityType as GlobalSearchEntityType | null;
          if (!target || !globalSearchFieldConfig[target]) continue;
          const existing = fieldsByTarget.get(target) ?? [];
          existing.push(field);
          fieldsByTarget.set(target, existing);
        }

        await Promise.all(
          Array.from(fieldsByTarget.entries()).map(async ([targetType, fields]) => {
            const table = getEntityTable(targetType);
            if (!table) return;
            const { titleField } = globalSearchFieldConfig[targetType];
            const rows = (await db
              .select({
                entityType: attributeValues.entityType,
                entityId: attributeValues.entityId,
                fieldId: storySchemaFields.id,
                fieldName: storySchemaFields.name,
                displayValue: columnsOf(table)[titleField],
              })
              .from(attributeValues)
              .innerJoin(storySchemaFields, eq(attributeValues.fieldId, storySchemaFields.id))
              .innerJoin(table, eq(attributeValues.value, columnsOf(table).id))
              .where(
                and(
                  eq(attributeValues.storyId, storyId),
                  eq(attributeValues.isDeleted, false),
                  inArray(
                    attributeValues.fieldId,
                    fields.map((field) => field.id),
                  ),
                  eq(columnsOf(table).isDeleted, false),
                  sql`${columnsOf(table)[titleField]} LIKE ${`%${trimmedTerm}%`} COLLATE NOCASE` as SQL<boolean>,
                ),
              )
              .limit(ATTRIBUTE_RESULT_LIMIT)
              .all()) as {
              entityType: string;
              entityId: string;
              fieldId: string;
              fieldName: string;
              displayValue: unknown;
            }[];

            const ownerIdsByType = new Map<GlobalSearchEntityType, Set<string>>();
            for (const row of rows) {
              const ownerType = row.entityType as GlobalSearchEntityType;
              if (!globalSearchFieldConfig[ownerType]) continue;
              if (!ownerIdsByType.has(ownerType)) ownerIdsByType.set(ownerType, new Set());
              ownerIdsByType.get(ownerType)!.add(row.entityId);
            }
            const ownerTitles = new Map<string, string>();
            await Promise.all(
              Array.from(ownerIdsByType.entries()).map(async ([ownerType, ids]) => {
                const ownerTable = getEntityTable(ownerType);
                if (!ownerTable) return;
                const ownerTitleField = globalSearchFieldConfig[ownerType].titleField;
                const ownerRows = (await db
                  .select({
                    id: columnsOf(ownerTable).id,
                    title: columnsOf(ownerTable)[ownerTitleField],
                  })
                  .from(ownerTable)
                  .where(
                    and(
                      inArray(columnsOf(ownerTable).id, Array.from(ids)),
                      eq(columnsOf(ownerTable).isDeleted, false),
                    ),
                  )
                  .all()) as { id: string; title: unknown }[];
                for (const row of ownerRows) {
                  ownerTitles.set(`${ownerType}:${row.id}`, String(row.title ?? ''));
                }
              }),
            );

            for (const row of rows) {
              const ownerType = row.entityType as GlobalSearchEntityType;
              if (!globalSearchFieldConfig[ownerType]) continue;
              const key = `${ownerType}:${row.entityId}`;
              if (results.has(key)) continue;
              const title = ownerTitles.get(key);
              if (title === undefined) continue;
              results.set(key, {
                entityType: ownerType,
                id: row.entityId,
                title,
                snippet: buildSnippet(row.fieldName, String(row.displayValue), trimmedTerm),
                isFavorite: null,
                occurrence: { field: `custom:${row.fieldId}`, needle: trimmedTerm },
              });
            }
          }),
        );
      })();

      await Promise.all([...nativeQueries, attributeQuery, entityAttributeQuery]);

      // Scene is no longer a drawer destination of its own: keeping the chapter here stops a search result
      // from looking like a loose scene and gives the author its narrative position.
      const sceneResults = Array.from(results.values()).filter(
        (result) => result.entityType === 'Scene',
      );
      if (sceneResults.length > 0) {
        const sceneContexts = await db
          .select({ sceneId: scenes.id, chapterName: chapters.name, chapterIndex: chapters.index })
          .from(scenes)
          .innerJoin(chapters, eq(scenes.chapterId, chapters.id))
          .where(
            inArray(
              scenes.id,
              sceneResults.map((result) => result.id),
            ),
          )
          .all();
        const contextBySceneId = new Map(
          sceneContexts.map((row) => [row.sceneId, `${row.chapterIndex}. ${row.chapterName}`]),
        );
        sceneResults.forEach((result) => {
          result.context = contextBySceneId.get(result.id);
        });
      }

      await labelResultsWithArcs(db, storyId, Array.from(results.values()));

      const favoriteService = createFavoriteService(db);
      await Promise.all(
        Array.from(FAVORITABLE_ENTITY_TYPES).map(async (entityType) => {
          const matchingResults = Array.from(results.values()).filter(
            (result) => result.entityType === entityType,
          );
          if (matchingResults.length === 0) return;

          const table = getEntityTable(entityType);
          if (!table || !columnsOf(table).isFavorite) return;
          const rows = (await db
            .select({
              id: columnsOf(table).id,
              isFavorite: columnsOf(table).isFavorite,
            })
            .from(table)
            .where(
              inArray(
                columnsOf(table).id,
                matchingResults.map((result) => result.id),
              ),
            )
            .all()) as { id: string; isFavorite: boolean }[];
          const decorated = await favoriteService.decorateEntities(
            storyId,
            entityType as FavoriteEntityType,
            localUserId,
            rows,
          );
          const favoriteById = new Map(decorated.map((row) => [row.id, row.isFavorite]));
          for (const result of matchingResults) {
            result.isFavorite = favoriteById.get(result.id) ?? false;
          }
        }),
      );

      return Array.from(results.values());
    },
  };
};
