import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ItemInsert, ItemSelect } from '../../db/schemas/items';
import { items } from '../../db/schemas/items';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { softDeleteRowSync } from './softDelete';
import { countActiveStoryEntities } from './storyEntityCount';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

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
  getItemCount(storyId?: string): Promise<number>;
  getById(itemId: string): Promise<ItemSelect | undefined>;
  createItem(currentUserId: string, itemData: Create<ItemInsert>): Promise<ItemSelect>;
  updateItem(
    currentUserId: string,
    itemId: string,
    itemData: Partial<
      Omit<
        ItemInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<ItemSelect>;
  deleteItem(currentUserId: string, itemId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<ItemSelect[]>;
}

export const createItemService = (db: AppDrizzleClient): ItemService => {
  const serverService = createServerService(db);

  return {
    async getItemCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, items, storyId);
    },

    async getItemsByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<ItemSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(items.storyId, storyId) as SQL<boolean>,
        eq(items.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(
          sql`${items.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      // These were previously compared against 'favorites'/'not-favorites' (plural), which
      // no caller ever sends - the UI emits the singular form - so the filter never matched.
      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(items.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(items.isFavorite, false) as SQL<boolean>);
      }

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'Item',
          items,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, items.id, field, value),
        )),
      );

      const finalConditions = conditions.filter((c) => c !== undefined) as SQL<boolean>[];
      let query = db
        .select()
        .from(items)
        .where(and(...finalConditions))
        .$dynamic();

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
      const item = await db.query.items.findFirst({
        where: and(eq(items.id, itemId), eq(items.isDeleted, false)),
      });
      return decorateFavorite(db, 'Item', item);
    },

    async createItem(currentUserId: string, itemData: Create<ItemInsert>): Promise<ItemSelect> {
      await assertStoryIsWritable(db, itemData.storyId);
      let newItem = prepareNewEntityData<ItemInsert>(itemData);
      const favorite = await normalizeFavoriteCreate(db, newItem.storyId, 'Item', newItem);
      newItem = favorite.data;
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newItem.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newItem.storyId, () => {
        const inserted = db.insert(items).values(newItem).returning().get();
        recordLocalOperationSync(db, newItem.storyId, userIdToLog, 'create', 'Item', newItem.id, {
          ...inserted,
        });
        return inserted;
      });
      // After the create, so its operation is never pushed ahead of the entity it points at.
      await persistInitialFavorite(
        db,
        newItem.storyId,
        newItem.id,
        'Item',
        currentUserId,
        favorite.individualFavorite,
      );
      entityEventEmitter.emit('item_changed', newItem.storyId, newItem.id);
      return result;
    },

    async updateItem(
      currentUserId: string,
      itemId: string,
      itemData: Partial<
        Omit<
          ItemInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<ItemSelect> {
      const originalItem = await db.query.items.findFirst({ where: eq(items.id, itemId) });
      if (!originalItem) throw new Error(`Item with ID ${itemId} not found for update.`);
      await assertStoryIsWritable(db, originalItem.storyId);
      itemData = await normalizeFavoriteUpdate(
        db,
        originalItem.storyId,
        itemId,
        'Item',
        currentUserId,
        itemData,
      );
      const potentialNewState = { ...originalItem, ...itemData };
      const changes = getChangedFields(originalItem, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;
      if (Object.keys(changes).length === 0) return originalItem;

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalItem.storyId,
        currentUserId,
      );
      const updatedItem = await runLocalWrite(db, originalItem.storyId, () => {
        db.update(items)
          .set({ ...itemData, updatedAt: new Date(), version: sql`${items.version} + 1` })
          .where(eq(items.id, itemId))
          .run();
        const updated = db.select().from(items).where(eq(items.id, itemId)).get();
        if (!updated) throw new Error(`Failed to retrieve updated item ${itemId}.`);

        recordLocalOperationSync(
          db,
          updated.storyId,
          userIdToLog,
          'update',
          'Item',
          itemId,
          getChangedFields(originalItem, updated),
        );
        return updated;
      });
      entityEventEmitter.emit('item_changed', updatedItem.storyId, updatedItem.id);
      return updatedItem;
    },

    async deleteItem(currentUserId: string, itemId: string): Promise<void> {
      const itemToDelete = await db.query.items.findFirst({ where: eq(items.id, itemId) });
      if (!itemToDelete) return;
      await assertStoryIsWritable(db, itemToDelete.storyId);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        itemToDelete.storyId,
        currentUserId,
      );
      const updatedItem = await runLocalWrite(db, itemToDelete.storyId, () => {
        return softDeleteRowSync(db, items, 'Item', itemId, userIdToLog);
      });
      entityEventEmitter.emit('item_changed', updatedItem.storyId, updatedItem.id);
    },

    async getAllByStoryId(storyId: string): Promise<ItemSelect[]> {
      if (!storyId) return [];
      try {
        return await db
          .select()
          .from(items)
          .where(and(eq(items.storyId, storyId), eq(items.isDeleted, false)))
          .orderBy(asc(items.createdAt))
          .all();
      } catch (error) {
        console.error(`Error fetching all items for story ${storyId}:`, error);
        return [];
      }
    },
  };
};
