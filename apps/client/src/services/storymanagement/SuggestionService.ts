import { and, eq, ne, sql } from 'drizzle-orm';
import { AppDrizzleClient, characterRelations, characters, itemJourneys, items, SuggestionInsert, SuggestionSelect, suggestions } from '../../db';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { assertStoryIsWritable, getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { createAttributeValueService } from './AttributeValueService';

const CUSTOM_ATTRIBUTE_TYPE_PREFIX = 'custom:';

export function customAttributeSuggestionType(fieldId: string): string {
  return `${CUSTOM_ATTRIBUTE_TYPE_PREFIX}${fieldId}`;
}

const suggestionConfig = {
  character_gender: { schema: characters, column: characters.gender },
  character_race: { schema: characters, column: characters.race },
  character_subrace: { schema: characters, column: characters.subrace },
  characterRelation_type: { schema: characterRelations, column: characterRelations.relationType },
  item_category: { schema: items, column: items.category },
  item_initial_state: { schema: items, column: items.initialState },
  item_state: { schema: itemJourneys, column: itemJourneys.newState },
};

export type SuggestionType = string;

export interface SuggestionServiceInterface {
  getSuggestions(type: SuggestionType, storyId: string): Promise<[string, number][]>;
  getStoredSuggestions(type: SuggestionType, storyId: string): Promise<SuggestionSelect[]>;
  createSuggestion(currentUserId: string, type: SuggestionType, value: string, storyId: string): Promise<SuggestionSelect>;
  updateSuggestion(currentUserId: string, id: string, value: string): Promise<void>;
  deleteSuggestion(currentUserId: string, id: string): Promise<void>;
}

export const createSuggestionService = (db: AppDrizzleClient): SuggestionServiceInterface => {
  const serverService = createServerService(db);

  const ensureUnique = async (storyId: string, type: string, value: string, excludeId?: string) => {
    const conditions = [
      eq(suggestions.storyId, storyId),
      eq(suggestions.type, type),
      eq(suggestions.value, value),
      eq(suggestions.isDeleted, false),
    ];
    if (excludeId) conditions.push(ne(suggestions.id, excludeId));
    const existing = await db.select({ id: suggestions.id }).from(suggestions).where(and(...conditions)).limit(1).get();
    if (existing) throw new Error('Suggestion already exists for this field.');
  };

  return {
    async getSuggestions(type, storyId) {
      if (!storyId) return [];
      const isCustomAttribute = type.startsWith(CUSTOM_ATTRIBUTE_TYPE_PREFIX);
      const config = isCustomAttribute ? null : suggestionConfig[type as keyof typeof suggestionConfig];
      if (!isCustomAttribute && !config) return [];

      const counts = new Map<string, number>();
      const stored = await db.select({ value: suggestions.value }).from(suggestions)
        .where(and(eq(suggestions.type, type), eq(suggestions.storyId, storyId), eq(suggestions.isDeleted, false))).all();
      stored.forEach(({ value }) => counts.set(value, counts.get(value) ?? 0));

      if (isCustomAttribute) {
        const fieldId = type.slice(CUSTOM_ATTRIBUTE_TYPE_PREFIX.length);
        (await createAttributeValueService(db).getValueUsageCounts(fieldId)).forEach(([value, count]) => {
          counts.set(value, (counts.get(value) ?? 0) + count);
        });
      } else {
        const nativeConfig = config!;
        const dynamic = await db.select({ value: nativeConfig.column, count: sql<number>`count(*)` }).from(nativeConfig.schema)
          .where(and(eq(nativeConfig.schema.storyId, storyId), eq(nativeConfig.schema.isDeleted, false))).groupBy(nativeConfig.column).all();
        dynamic.forEach(({ value, count }) => {
          if (value && typeof value === 'string') counts.set(value, (counts.get(value) ?? 0) + count);
        });
      }
      return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    },

    async getStoredSuggestions(type, storyId) {
      return db.select().from(suggestions).where(and(
        eq(suggestions.type, type), eq(suggestions.storyId, storyId), eq(suggestions.isDeleted, false),
      )).orderBy(suggestions.value).all();
    },

    async createSuggestion(currentUserId, type, value, storyId) {
      const normalizedValue = value.trim();
      if (!normalizedValue || !type || !storyId) throw new Error('Suggestion type, value, and story are required.');
      await assertStoryIsWritable(db, storyId);
      await ensureUnique(storyId, type, normalizedValue);
      const now = new Date();
      const suggestion: SuggestionInsert = {
        id: createULID(), storyId, type, value: normalizedValue, createdAt: now, updatedAt: now,
        version: 1, isDeleted: false, deletedAt: null,
      };
      const created = await db.insert(suggestions).values(suggestion).returning().get();
      const userId = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userId, 'create', 'Suggestion', created.id, { ...created });
      entityEventEmitter.emit('suggestion_changed', storyId, created.id);
      return created;
    },

    async updateSuggestion(currentUserId, id, value) {
      const current = await db.query.suggestions.findFirst({ where: eq(suggestions.id, id) });
      if (!current || current.isDeleted) throw new Error('Suggestion not found.');
      const normalizedValue = value.trim();
      if (!normalizedValue) throw new Error('Suggestion value is required.');
      await assertStoryIsWritable(db, current.storyId);
      if (normalizedValue === current.value) return;
      await ensureUnique(current.storyId, current.type, normalizedValue, id);
      const [updated] = await db.update(suggestions).set({ value: normalizedValue, updatedAt: new Date(), version: sql`${suggestions.version} + 1` })
        .where(eq(suggestions.id, id)).returning({ id: suggestions.id, storyId: suggestions.storyId, version: suggestions.version });
      if (!updated) throw new Error('Could not update suggestion.');
      const userId = await getUserIdForOperation(db, serverService, updated.storyId, currentUserId);
      await recordLocalOperation(db, updated.storyId, userId, 'update', 'Suggestion', id, { value: normalizedValue, version: updated.version });
      entityEventEmitter.emit('suggestion_changed', updated.storyId, id);
    },

    async deleteSuggestion(currentUserId, id) {
      const current = await db.query.suggestions.findFirst({ where: eq(suggestions.id, id) });
      if (!current || current.isDeleted) return;
      await assertStoryIsWritable(db, current.storyId);
      const [updated] = await db.update(suggestions).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${suggestions.version} + 1` })
        .where(eq(suggestions.id, id)).returning({ id: suggestions.id, storyId: suggestions.storyId, version: suggestions.version });
      if (!updated) throw new Error('Could not delete suggestion.');
      const userId = await getUserIdForOperation(db, serverService, updated.storyId, currentUserId);
      await recordLocalOperation(db, updated.storyId, userId, 'delete', 'Suggestion', id, { id, isDeleted: true, version: updated.version });
      entityEventEmitter.emit('suggestion_changed', updated.storyId, id);
    },
  };
};
