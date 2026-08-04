import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { ItemInsert, items, ItemSelect } from '../../db/schemas/items';
import { Create, getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';

export type { FavoriteFilterState };

export interface ItemService {
  getItemsByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<ItemSelect[]>;
  getById(itemId: string): Promise<ItemSelect | undefined>;
  createItem(currentUserId: string, itemData: Create<ItemInsert>): Promise<ItemSelect>;
  updateItem(currentUserId: string, itemId: string, itemData: Partial<Omit<ItemInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ItemSelect>;
  deleteItem(currentUserId: string, itemId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<ItemSelect[]>;
}

export const createItemService = (db: AppDrizzleClient): ItemService => {
  const serverService = createServerService(db);

  return {
    async getItemsByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria
    ): Promise<ItemSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(items.storyId, storyId) as SQL<boolean>,
        eq(items.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${items.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      // These were previously compared against 'favorites'/'not-favorites' (plural), which
      // no caller ever sends - the UI emits the singular form - so the filter never matched.
      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(items.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(items.isFavorite, false) as SQL<boolean>);
      }

      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const itemMetadata = entityFieldMetadata['Item'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = itemMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${items[key as keyof ItemSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'number') {
                conditions.push(eq(items[key as keyof ItemSelect], Number(value)) as SQL<boolean>);
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(items[key as keyof ItemSelect], value === 'true') as SQL<boolean>);
              }
            } else if (value !== undefined && value !== '') {
              const customCondition = await buildCustomAttributeSearchCondition(db, items.id, key, value);
              if (customCondition) {
                conditions.push(customCondition);
              }
            }
          }
        }
      }

      const finalConditions = conditions.filter(c => c !== undefined) as SQL<boolean>[];
      let query = db.select().from(items).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        const sortKey = sortBy as keyof ItemSelect;
        if (items[sortKey]) {
          query = query.orderBy(orderBy(items[sortKey]));
        } else {
          console.warn(`Unknown sortBy field: ${sortBy}`);
        }
      } else {
        query = query.orderBy(asc(items.createdAt));
      }

      return query.all();
    },

    async getById(itemId: string): Promise<ItemSelect | undefined> {
      return db.query.items.findFirst({
        where: and(eq(items.id, itemId), eq(items.isDeleted, false)),
      });
    },

    async createItem(currentUserId: string, itemData: Create<ItemInsert>): Promise<ItemSelect> {
      const newItem = prepareNewEntityData<ItemInsert>(itemData);
      const result = await db.insert(items).values(newItem).returning().get();
      const userIdToLog = await getUserIdForOperation(db, serverService, newItem.storyId, currentUserId);
      await recordLocalOperation(db, newItem.storyId, userIdToLog, 'create', 'Item', newItem.id, { ...result });
      entityEventEmitter.emit('item_changed', newItem.storyId, newItem.id);
      return result;
    },

    async updateItem(currentUserId: string, itemId: string, itemData: Partial<Omit<ItemInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ItemSelect> {
      const originalItem = await db.query.items.findFirst({ where: eq(items.id, itemId) });
      if (!originalItem) throw new Error(`Item with ID ${itemId} not found for update.`);
      const potentialNewState = { ...originalItem, ...itemData };
      const changes = getChangedFields(originalItem, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;
      if (Object.keys(changes).length === 0) return originalItem;

      await db.update(items).set({ ...itemData, updatedAt: new Date(), version: sql`${items.version} + 1` }).where(eq(items.id, itemId));
      const updatedItem = await db.query.items.findFirst({ where: eq(items.id, itemId) });
      if (!updatedItem) throw new Error(`Failed to retrieve updated item ${itemId}.`);

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedItem.storyId, currentUserId);
      await recordLocalOperation(db, updatedItem.storyId, userIdToLog, 'update', 'Item', itemId, getChangedFields(originalItem, updatedItem));
      entityEventEmitter.emit('item_changed', updatedItem.storyId, updatedItem.id);
      return updatedItem;
    },

    async deleteItem(currentUserId: string, itemId: string): Promise<void> {
      const itemToDelete = await db.query.items.findFirst({ where: eq(items.id, itemId) });
      if (!itemToDelete) return;
      const [updatedItem] = await db.update(items)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${items.version} + 1` })
        .where(eq(items.id, itemId))
        .returning({ id: items.id, storyId: items.storyId, isDeleted: items.isDeleted, version: items.version });
      if (!updatedItem) throw new Error(`Failed to delete item ${itemId} or item not found.`);
      const userIdToLog = await getUserIdForOperation(db, serverService, updatedItem.storyId, currentUserId);
      await recordLocalOperation(db, updatedItem.storyId, userIdToLog, 'delete', 'Item', itemId, {
        id: updatedItem.id,
        isDeleted: updatedItem.isDeleted,
        version: updatedItem.version,
      });
      entityEventEmitter.emit('item_changed', updatedItem.storyId, updatedItem.id);
    },

    async getAllByStoryId(storyId: string): Promise<ItemSelect[]> {
      if (!storyId) return [];
      try {
        return await db.select().from(items).where(and(eq(items.storyId, storyId), eq(items.isDeleted, false))).orderBy(asc(items.createdAt)).all();
      } catch (error) {
        console.error(`Error fetching all items for story ${storyId}:`, error);
        return [];
      }
    },
  };
};