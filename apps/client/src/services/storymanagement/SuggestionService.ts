import { and, eq, ne, sql } from 'drizzle-orm';
import { deriveAttributeKey } from '@keres/shared';
import type { AppDrizzleClient, SuggestionInsert, SuggestionSelect } from '../../db';
import { suggestions } from '../../db';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import {
  createSuggestionUsageService,
  isNativeSuggestionType,
  type SuggestionType,
  type SuggestionUsage,
} from './SuggestionUsageService';
import {
  isCustomAttributeSuggestionType,
  isNamedListType,
  isWorldPieceSuggestionType,
  LIST_CATALOG_TYPE,
  namedListType,
  type NamedSuggestionList,
  parseNamedListCatalogValue,
} from './suggestionTypes';

export {
  customAttributeSuggestionType,
  isNamedListType,
  isWorldPieceSuggestionType,
  LIST_CATALOG_TYPE,
  NAMED_LIST_TYPE_PREFIX,
  namedListDisplayKey,
  namedListType,
  parseNamedListCatalogValue,
  WORLD_PIECE_CATEGORY_TYPE,
  WORLD_PIECE_TYPE_PREFIX,
} from './suggestionTypes';
export type { NamedSuggestionList } from './suggestionTypes';
export type {
  SuggestionType,
  SuggestionUsage,
  SuggestionUsageEntityType,
} from './SuggestionUsageService';

export interface SuggestionServiceInterface {
  getSuggestions(type: SuggestionType, storyId: string): Promise<[string, number][]>;
  /** Distinct values currently present in story entities, excluding saved catalog values. */
  getSuggestionUsageCounts(type: SuggestionType, storyId: string): Promise<[string, number][]>;
  getStoredSuggestions(type: SuggestionType, storyId: string): Promise<SuggestionSelect[]>;
  getSuggestionUsages(
    type: SuggestionType,
    storyId: string,
    value: string,
  ): Promise<SuggestionUsage[]>;
  renameSuggestionValue(
    currentUserId: string,
    storyId: string,
    type: SuggestionType,
    oldValue: string,
    newValue: string,
    renameUsages: boolean,
  ): Promise<{ updatedUsages: number; merged: boolean }>;
  createSuggestion(
    currentUserId: string,
    type: SuggestionType,
    value: string,
    storyId: string,
  ): Promise<SuggestionSelect>;
  updateSuggestion(currentUserId: string, id: string, value: string): Promise<void>;
  deleteSuggestion(currentUserId: string, id: string): Promise<void>;
  listNamedLists(storyId: string): Promise<NamedSuggestionList[]>;
  createNamedList(
    currentUserId: string,
    storyId: string,
    name: string,
  ): Promise<NamedSuggestionList>;
  renameNamedList(
    currentUserId: string,
    storyId: string,
    type: string,
    name: string,
  ): Promise<NamedSuggestionList>;
  deleteNamedList(currentUserId: string, storyId: string, type: string): Promise<void>;
  copyStoredValues(
    currentUserId: string,
    storyId: string,
    fromType: string,
    toTypes: string[],
  ): Promise<{ copied: number; skipped: number }>;
}

export const createSuggestionService = (db: AppDrizzleClient): SuggestionServiceInterface => {
  const serverService = createServerService(db);
  const usageService = createSuggestionUsageService(db);

  const ensureUnique = async (storyId: string, type: string, value: string, excludeId?: string) => {
    const conditions = [
      eq(suggestions.storyId, storyId),
      eq(suggestions.type, type),
      eq(suggestions.value, value),
      eq(suggestions.isDeleted, false),
    ];
    if (excludeId) conditions.push(ne(suggestions.id, excludeId));
    const existing = await db
      .select({ id: suggestions.id })
      .from(suggestions)
      .where(and(...conditions))
      .limit(1)
      .get();
    if (existing) throw new Error('Suggestion already exists for this field.');
  };

  return {
    async getSuggestions(type, storyId) {
      if (!storyId) return [];
      const isCustomAttribute = isCustomAttributeSuggestionType(type);
      const isNamedList = isNamedListType(type);
      if (
        !isCustomAttribute &&
        !isNamedList &&
        !isWorldPieceSuggestionType(type) &&
        !isNativeSuggestionType(type)
      ) {
        return [];
      }

      const counts = new Map<string, number>();
      const stored = await db
        .select({ value: suggestions.value })
        .from(suggestions)
        .where(
          and(
            eq(suggestions.type, type),
            eq(suggestions.storyId, storyId),
            eq(suggestions.isDeleted, false),
          ),
        )
        .all();
      stored.forEach(({ value }) => counts.set(value, counts.get(value) ?? 0));

      (await usageService.getSuggestionUsageCounts(type, storyId)).forEach(([value, count]) => {
        counts.set(value, (counts.get(value) ?? 0) + count);
      });
      return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    },

    getSuggestionUsageCounts: usageService.getSuggestionUsageCounts,

    getSuggestionUsages: usageService.getSuggestionUsages,

    async renameSuggestionValue(currentUserId, storyId, type, oldValue, newValue, renameUsages) {
      const normalizedValue = newValue.trim();
      if (!normalizedValue) throw new Error('Suggestion value is required.');
      if (normalizedValue === oldValue) return { updatedUsages: 0, merged: false };
      await assertStoryIsWritable(db, storyId);
      const stored = await this.getStoredSuggestions(type, storyId);
      const source = stored.find((suggestion) => suggestion.value === oldValue);
      const destination = stored.find((suggestion) => suggestion.value === normalizedValue);
      const merged = Boolean(destination && destination.id !== source?.id);
      const usageCount = (await usageService.getSuggestionUsages(type, storyId, oldValue)).length;
      if (merged && usageCount > 0 && !renameUsages) {
        throw new Error('Renaming to an existing saved value requires merging all story usages.');
      }
      if (source) {
        if (merged) await this.deleteSuggestion(currentUserId, source.id);
        else await this.updateSuggestion(currentUserId, source.id, normalizedValue);
      }
      const updatedUsages = renameUsages
        ? await usageService.renameSuggestionUsages(
            currentUserId,
            storyId,
            type,
            oldValue,
            normalizedValue,
          )
        : 0;
      return { updatedUsages, merged };
    },

    async getStoredSuggestions(type, storyId) {
      return db
        .select()
        .from(suggestions)
        .where(
          and(
            eq(suggestions.type, type),
            eq(suggestions.storyId, storyId),
            eq(suggestions.isDeleted, false),
          ),
        )
        .orderBy(suggestions.value)
        .all();
    },

    async createSuggestion(currentUserId, type, value, storyId) {
      const normalizedValue = value.trim();
      if (!normalizedValue || !type || !storyId)
        throw new Error('Suggestion type, value, and story are required.');
      await assertStoryIsWritable(db, storyId);
      await ensureUnique(storyId, type, normalizedValue);
      const now = new Date();
      const suggestion: SuggestionInsert = {
        id: createULID(),
        storyId,
        type,
        value: normalizedValue,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };
      const created = await db.insert(suggestions).values(suggestion).returning().get();
      const userId = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userId, 'create', 'Suggestion', created.id, {
        ...created,
      });
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
      const [updated] = await db
        .update(suggestions)
        .set({
          value: normalizedValue,
          updatedAt: new Date(),
          version: sql`${suggestions.version} + 1`,
        })
        .where(eq(suggestions.id, id))
        .returning({
          id: suggestions.id,
          storyId: suggestions.storyId,
          version: suggestions.version,
        });
      if (!updated) throw new Error('Could not update suggestion.');
      const userId = await getUserIdForOperation(db, serverService, updated.storyId, currentUserId);
      await recordLocalOperation(db, updated.storyId, userId, 'update', 'Suggestion', id, {
        value: normalizedValue,
        version: updated.version,
      });
      entityEventEmitter.emit('suggestion_changed', updated.storyId, id);
    },

    async deleteSuggestion(currentUserId, id) {
      const current = await db.query.suggestions.findFirst({ where: eq(suggestions.id, id) });
      if (!current || current.isDeleted) return;
      await assertStoryIsWritable(db, current.storyId);
      const [updated] = await db
        .update(suggestions)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${suggestions.version} + 1`,
        })
        .where(eq(suggestions.id, id))
        .returning({
          id: suggestions.id,
          storyId: suggestions.storyId,
          version: suggestions.version,
        });
      if (!updated) throw new Error('Could not delete suggestion.');
      const userId = await getUserIdForOperation(db, serverService, updated.storyId, currentUserId);
      await recordLocalOperation(db, updated.storyId, userId, 'delete', 'Suggestion', id, {
        id,
        isDeleted: true,
        version: updated.version,
      });
      entityEventEmitter.emit('suggestion_changed', updated.storyId, id);
    },

    async listNamedLists(storyId) {
      const rows = await this.getStoredSuggestions(LIST_CATALOG_TYPE, storyId);
      return rows
        .map((row) => parseNamedListCatalogValue(row.value))
        .filter((entry): entry is NamedSuggestionList => entry !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createNamedList(currentUserId, storyId, name) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Suggestion list name is required.');
      const slug = deriveAttributeKey(trimmed);
      const type = namedListType(createULID(), slug);
      await this.createSuggestion(
        currentUserId,
        LIST_CATALOG_TYPE,
        JSON.stringify({ type, name: trimmed }),
        storyId,
      );
      return { type, name: trimmed };
    },

    async renameNamedList(currentUserId, storyId, type, name) {
      if (!isNamedListType(type)) throw new Error('Not a named suggestion list.');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Suggestion list name is required.');
      const catalog = await this.getStoredSuggestions(LIST_CATALOG_TYPE, storyId);
      const catalogRow = catalog.find(
        (row) => parseNamedListCatalogValue(row.value)?.type === type,
      );
      if (!catalogRow) throw new Error('Suggestion list not found.');
      await this.updateSuggestion(
        currentUserId,
        catalogRow.id,
        JSON.stringify({ type, name: trimmed }),
      );
      return { type, name: trimmed };
    },

    async deleteNamedList(currentUserId, storyId, type) {
      if (!isNamedListType(type)) throw new Error('Not a named suggestion list.');
      const catalog = await this.getStoredSuggestions(LIST_CATALOG_TYPE, storyId);
      const catalogRow = catalog.find(
        (row) => parseNamedListCatalogValue(row.value)?.type === type,
      );
      const items = await this.getStoredSuggestions(type, storyId);
      for (const row of [...items, ...(catalogRow ? [catalogRow] : [])]) {
        await this.deleteSuggestion(currentUserId, row.id);
      }
    },

    async copyStoredValues(currentUserId, storyId, fromType, toTypes) {
      if (!fromType || fromType === LIST_CATALOG_TYPE) {
        throw new Error('Cannot copy from the list catalog.');
      }
      const source = await this.getStoredSuggestions(fromType, storyId);
      const values = source.map((row) => row.value);
      let copied = 0;
      let skipped = 0;
      const destinations = [...new Set(toTypes)].filter(
        (type) => type && type !== fromType && type !== LIST_CATALOG_TYPE,
      );
      for (const destType of destinations) {
        const existing = new Set(
          (await this.getStoredSuggestions(destType, storyId)).map((row) => row.value),
        );
        for (const value of values) {
          if (existing.has(value)) {
            skipped += 1;
            continue;
          }
          await this.createSuggestion(currentUserId, destType, value, storyId);
          existing.add(value);
          copied += 1;
        }
      }
      return { copied, skipped };
    },
  };
};
