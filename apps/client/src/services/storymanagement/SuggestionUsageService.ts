import type { StorySchemaEntityType } from '@keres/shared';
import {
  AttributeType,
  encodeAttributeValue,
  explodeAttributeUsageValue,
  getSuggestionSource,
  isSuggestionAttributeType,
} from '@keres/shared';
import type { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';
import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import {
  attributeValues,
  characterRelations,
  characters,
  itemJourneys,
  items,
  storySchemaFields,
} from '../../db';
import { createEntityNameBatchResolver } from '../EntityNameBatchResolver';
import { createAttributeValueService } from './AttributeValueService';
import { createCharacterRelationService } from './CharacterRelationService';
import { createCharacterService } from './CharacterService';
import { createItemJourneyService } from './ItemJourneyService';
import { createItemService } from './ItemService';
import { isNamedListType, isWorldPieceSuggestionType, suggestionFieldId } from './suggestionTypes';

export type SuggestionType = string;
export type SuggestionUsageEntityType =
  | Exclude<GlobalSearchEntityType, 'Plot'>
  | 'CharacterRelation';
export interface SuggestionUsage {
  entityType: SuggestionUsageEntityType;
  id: string;
  title: string;
  snippet: string;
  context?: string;
  characterIds?: string[];
  characterNames?: string[];
}

const suggestionPersistence = {
  character_gender: { schema: characters, column: characters.gender },
  character_race: { schema: characters, column: characters.race },
  character_subrace: { schema: characters, column: characters.subrace },
  characterRelation_type: { schema: characterRelations, column: characterRelations.relationType },
  item_category: { schema: items, column: items.category },
  item_initial_state: { schema: items, column: items.initialState },
  item_state: { schema: itemJourneys, column: itemJourneys.newState },
};

function getNativeSuggestionConfig(type: string) {
  const persistence = suggestionPersistence[type as keyof typeof suggestionPersistence];
  const domain = getSuggestionSource(type);
  return persistence && domain ? { ...persistence, ...domain } : undefined;
}

export function isNativeSuggestionType(type: string): boolean {
  return getNativeSuggestionConfig(type) !== undefined;
}

/**
 * Finds and changes values used by suggestions without owning the suggestion catalogue itself.
 * Native values are updated through their entity services so permissions, operation logs and UI
 * notifications remain exactly the same as when a writer edits the source entity directly.
 */
export function createSuggestionUsageService(db: AppDrizzleClient) {
  const getSuggestionUsageCounts = async (
    type: SuggestionType,
    storyId: string,
  ): Promise<[string, number][]> => {
    if (!storyId || isNamedListType(type) || isWorldPieceSuggestionType(type)) return [];
    const fieldId = suggestionFieldId(type);
    if (fieldId) return createAttributeValueService(db).getValueUsageCounts(fieldId);

    const config = getNativeSuggestionConfig(type);
    if (!config) return [];
    const rows = await db
      .select({ value: config.column, count: sql<number>`count(*)` })
      .from(config.schema)
      .where(and(eq(config.schema.storyId, storyId), eq(config.schema.isDeleted, false)))
      .groupBy(config.column)
      .all();
    return rows
      .filter(({ value }) => typeof value === 'string' && Boolean(value))
      .map(({ value, count }) => [value as string, count]);
  };

  const getSuggestionUsages = async (
    type: SuggestionType,
    storyId: string,
    value: string,
  ): Promise<SuggestionUsage[]> => {
    if (!storyId || !value || isNamedListType(type)) return [];
    const fieldId = suggestionFieldId(type);
    if (fieldId) {
      const field = await db.query.storySchemaFields.findFirst({
        where: and(eq(storySchemaFields.id, fieldId), eq(storySchemaFields.storyId, storyId)),
      });
      if (!field || !isSuggestionAttributeType(field.type)) return [];
      const rows = await db
        .select()
        .from(attributeValues)
        .where(
          and(
            eq(attributeValues.storyId, storyId),
            eq(attributeValues.fieldId, fieldId),
            eq(attributeValues.isDeleted, false),
          ),
        )
        .all();
      const matching = rows.filter((row) =>
        explodeAttributeUsageValue(field.type as AttributeType, row.value ?? '').includes(value),
      );
      const refs = matching.flatMap((row) => {
        const entityType = row.entityType as GlobalSearchEntityType;
        return globalSearchFieldConfig[entityType] ? [{ entityType, entityId: row.entityId }] : [];
      });
      const titles = await createEntityNameBatchResolver(db).resolveMany(refs, {
        includeDeleted: false,
      });
      return matching.flatMap((row) => {
        const entityType = row.entityType as GlobalSearchEntityType;
        if (entityType === 'Plot') return [];
        const title = titles.get(`${entityType}:${row.entityId}`);
        return title === undefined
          ? []
          : [{ entityType, id: row.entityId, title, snippet: `${field.name}: ${value}` }];
      });
    }

    const config = getNativeSuggestionConfig(type);
    if (!config) return [];
    const rows = await db
      .select()
      .from(config.schema)
      .where(
        and(
          eq(config.schema.storyId, storyId),
          eq(config.schema.isDeleted, false),
          eq(config.column, value),
        ),
      )
      .all();
    if (config.entityType === 'CharacterRelation') {
      const ids = Array.from(
        new Set(rows.flatMap((row: any) => [row.character1Id, row.character2Id])),
      );
      const names = new Map(
        (
          await db
            .select({ id: characters.id, name: characters.name })
            .from(characters)
            .where(and(inArray(characters.id, ids), eq(characters.isDeleted, false)))
            .all()
        ).map((row) => [row.id, row.name]),
      );
      return rows.map((row: any) => ({
        entityType: 'CharacterRelation' as const,
        id: row.id,
        title: `${names.get(row.character1Id) ?? ''} ↔ ${names.get(row.character2Id) ?? ''}`,
        snippet: value,
        characterIds: [row.character1Id, row.character2Id],
        characterNames: [names.get(row.character1Id) ?? '', names.get(row.character2Id) ?? ''],
      }));
    }
    const titleField =
      config.entityType === 'Character' || config.entityType === 'Item' ? 'name' : 'newState';
    return rows.map((row: any) => ({
      entityType: config.entityType as SuggestionUsageEntityType,
      id: row.id,
      title: String(row[titleField] ?? ''),
      snippet: `${config.field}: ${value}`,
    }));
  };

  const renameSuggestionUsages = async (
    currentUserId: string,
    storyId: string,
    type: SuggestionType,
    oldValue: string,
    newValue: string,
  ): Promise<number> => {
    const usages = await getSuggestionUsages(type, storyId, oldValue);
    if (usages.length === 0) return 0;

    const fieldId = suggestionFieldId(type);
    if (fieldId) {
      const field = await db.query.storySchemaFields.findFirst({
        where: eq(storySchemaFields.id, fieldId),
      });
      if (!field) return 0;
      const rows = await db
        .select()
        .from(attributeValues)
        .where(
          and(
            eq(attributeValues.storyId, storyId),
            eq(attributeValues.fieldId, fieldId),
            eq(attributeValues.isDeleted, false),
          ),
        )
        .all();
      const matching = rows.filter((row) =>
        explodeAttributeUsageValue(field.type as AttributeType, row.value ?? '').includes(oldValue),
      );
      const service = createAttributeValueService(db);
      await Promise.all(
        matching.map((row) => {
          const next =
            field.type === AttributeType.SUGGESTION_LIST
              ? encodeAttributeValue(
                  AttributeType.SUGGESTION_LIST,
                  explodeAttributeUsageValue(AttributeType.SUGGESTION_LIST, row.value ?? '').map(
                    (entry) => (entry === oldValue ? newValue : entry),
                  ),
                )
              : newValue;
          return service.saveValuesForEntity(
            currentUserId,
            storyId,
            row.entityType as StorySchemaEntityType,
            row.entityId,
            { [fieldId]: next },
          );
        }),
      );
      return matching.length;
    }

    const config = getNativeSuggestionConfig(type);
    if (!config) return 0;
    const rows = await db
      .select()
      .from(config.schema)
      .where(
        and(
          eq(config.schema.storyId, storyId),
          eq(config.schema.isDeleted, false),
          eq(config.column, oldValue),
        ),
      )
      .all();

    const characterService = createCharacterService(db);
    const itemService = createItemService(db);
    const relationService = createCharacterRelationService(db);
    const journeyService = createItemJourneyService(db);
    for (const row of rows as any[]) {
      switch (type) {
        case 'character_gender':
        case 'character_race':
        case 'character_subrace':
          await characterService.updateCharacter(currentUserId, row.id, {
            [config.field]: newValue,
          });
          break;
        case 'item_category':
        case 'item_initial_state':
          await itemService.updateItem(currentUserId, row.id, { [config.field]: newValue });
          break;
        case 'characterRelation_type':
          await relationService.saveCharacterRelation(currentUserId, {
            ...row,
            relationType: newValue,
          });
          break;
        case 'item_state':
          await journeyService.updateItemJourney(currentUserId, row.id, { newState: newValue });
          break;
      }
    }
    return rows.length;
  };

  return { getSuggestionUsageCounts, getSuggestionUsages, renameSuggestionUsages };
}
