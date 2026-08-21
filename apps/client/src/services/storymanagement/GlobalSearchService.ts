import {
  AttributeType,
  decodeAttributeValue,
  FavoriteEntityType,
  joinSuggestionListForDisplay,
} from '@keres/shared';
import {
  globalSearchFieldConfig,
  GlobalSearchEntityType,
} from '@keres/shared/metadata/globalSearchFields';
import { and, eq, inArray, ne, or, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { attributeValues, storySchemaFields } from '../../db/schema';
import { getEntityTable } from '../entityTableRegistry';
import { truncate } from '../../utils/stringUtils';
import { createFavoriteService } from './FavoriteService';

export interface GlobalSearchResult {
  entityType: GlobalSearchEntityType;
  id: string;
  title: string;
  snippet: string;
  /** `null` marks entity types that do not support favorites. */
  isFavorite: boolean | null;
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

function buildSnippet(fieldLabel: string, value: unknown): string {
  return truncate(`${fieldLabel}: ${String(value)}`, SNIPPET_MAX_LENGTH);
}

/** First configured search field whose value actually contains `term` (case-insensitive) - used to pick which field to show in the snippet. */
function findMatchingField(
  row: Record<string, any>,
  searchFields: string[],
  term: string,
): { field: string; value: any } | null {
  const lowerTerm = term.toLowerCase();
  for (const field of searchFields) {
    const value = row[field];
    if (typeof value === 'string' && value.toLowerCase().includes(lowerTerm)) {
      return { field, value };
    }
  }
  return null;
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
              eq((table as any).storyId, storyId),
              eq((table as any).isDeleted, false),
              or(
                ...searchFields.map(
                  (field) =>
                    sql`${(table as any)[field]} LIKE ${`%${trimmedTerm}%`} COLLATE NOCASE` as SQL<boolean>,
                ),
              ),
            ),
          )
          .limit(NATIVE_RESULT_LIMIT_PER_ENTITY)
          .all();

        for (const row of rows as Record<string, any>[]) {
          const match = findMatchingField(row, searchFields, trimmedTerm);
          // Modo não tem tela própria: o resultado carrega o id do personagem dono, que é para
          // onde `navigateToEntityDetail` leva (ver ENTITY_ROUTES.Mode em entityNavigation).
          const resultId = entityType === 'Mode' ? row.characterId : row.id;
          const key = `${entityType}:${row.id}`;
          results.set(key, {
            entityType,
            id: resultId,
            title: String(row[titleField] ?? ''),
            snippet: match ? buildSnippet(match.field, match.value) : '',
            isFavorite: null,
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
              ne(storySchemaFields.type, 'entity'),
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
              .select({ id: (table as any).id, title: (table as any)[titleField] })
              .from(table)
              .where(
                and(
                  inArray((table as any).id, Array.from(idSet)),
                  eq((table as any).isDeleted, false),
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
          results.set(key, {
            entityType,
            id: row.attribute.entityId,
            title,
            snippet: buildSnippet(
              row.field.name,
              formatAttributeSearchValue(row.field.type, row.attribute.value),
            ),
            isFavorite: null,
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
              eq(storySchemaFields.type, 'entity'),
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
                fieldName: storySchemaFields.name,
                displayValue: (table as any)[titleField],
              })
              .from(attributeValues)
              .innerJoin(storySchemaFields, eq(attributeValues.fieldId, storySchemaFields.id))
              .innerJoin(table, eq(attributeValues.value, (table as any).id))
              .where(
                and(
                  eq(attributeValues.storyId, storyId),
                  eq(attributeValues.isDeleted, false),
                  inArray(
                    attributeValues.fieldId,
                    fields.map((field) => field.id),
                  ),
                  eq((table as any).isDeleted, false),
                  sql`${(table as any)[titleField]} LIKE ${`%${trimmedTerm}%`} COLLATE NOCASE` as SQL<boolean>,
                ),
              )
              .limit(ATTRIBUTE_RESULT_LIMIT)
              .all()) as {
              entityType: string;
              entityId: string;
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
                    id: (ownerTable as any).id,
                    title: (ownerTable as any)[ownerTitleField],
                  })
                  .from(ownerTable)
                  .where(
                    and(
                      inArray((ownerTable as any).id, Array.from(ids)),
                      eq((ownerTable as any).isDeleted, false),
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
                snippet: buildSnippet(row.fieldName, row.displayValue),
                isFavorite: null,
              });
            }
          }),
        );
      })();

      await Promise.all([...nativeQueries, attributeQuery, entityAttributeQuery]);

      const favoriteService = createFavoriteService(db);
      await Promise.all(
        Array.from(FAVORITABLE_ENTITY_TYPES).map(async (entityType) => {
          const matchingResults = Array.from(results.values()).filter(
            (result) => result.entityType === entityType,
          );
          if (matchingResults.length === 0) return;

          const table = getEntityTable(entityType);
          if (!table || !(table as any).isFavorite) return;
          const rows = (await db
            .select({
              id: (table as any).id,
              isFavorite: (table as any).isFavorite,
            })
            .from(table)
            .where(
              inArray(
                (table as any).id,
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
