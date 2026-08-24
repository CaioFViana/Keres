import type { ItemJourney } from '@keres/shared/entities/Item';
import { OperationLogEntityType } from '@keres/shared/metadata/OperationLogEntityType';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient} from '../../db';
import { itemJourneys } from '../../db';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface ItemJourneyService {
  getById(id: string): Promise<ItemJourney | undefined>;
  getAllByStoryId(storyId: string): Promise<ItemJourney[]>;
  getItemJourneysBySceneId(storyId: string, sceneId: string): Promise<ItemJourney[]>;
  getItemJourneysByItemId(storyId: string, itemId: string): Promise<ItemJourney[]>;
  createItemJourney(
    userId: string,
    itemJourneyData: Omit<
      ItemJourney,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
    >,
  ): Promise<ItemJourney>;
  updateItemJourney(
    userId: string,
    id: string,
    itemJourneyData: Partial<
      Omit<
        ItemJourney,
        | 'id'
        | 'storyId'
        | 'itemId'
        | 'createdAt'
        | 'updatedAt'
        | 'version'
        | 'isDeleted'
        | 'deletedAt'
      >
    >,
  ): Promise<ItemJourney>;
  deleteItemJourney(userId: string, id: string): Promise<void>;
}

export const createItemJourneyService = (db: AppDrizzleClient): ItemJourneyService => {
  const serverService = createServerService(db);
  return {
    async getById(id: string): Promise<ItemJourney | undefined> {
      return db.query.itemJourneys.findFirst({
        where: and(eq(itemJourneys.id, id), eq(itemJourneys.isDeleted, false)),
      });
    },

    async getAllByStoryId(storyId: string): Promise<ItemJourney[]> {
      return db.query.itemJourneys.findMany({
        where: and(eq(itemJourneys.storyId, storyId), eq(itemJourneys.isDeleted, false)),
        orderBy: [itemJourneys.createdAt],
      });
    },

    async getItemJourneysBySceneId(storyId: string, sceneId: string): Promise<ItemJourney[]> {
      return db.query.itemJourneys.findMany({
        where: and(
          eq(itemJourneys.storyId, storyId),
          eq(itemJourneys.sceneId, sceneId),
          eq(itemJourneys.isDeleted, false),
        ),
        orderBy: [itemJourneys.createdAt],
      });
    },

    async getItemJourneysByItemId(storyId: string, itemId: string): Promise<ItemJourney[]> {
      return db.query.itemJourneys.findMany({
        where: and(
          eq(itemJourneys.storyId, storyId),
          eq(itemJourneys.itemId, itemId),
          eq(itemJourneys.isDeleted, false),
        ),
        orderBy: [itemJourneys.createdAt],
      });
    },

    async createItemJourney(
      userId: string,
      itemJourneyData: Omit<
        ItemJourney,
        'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >,
    ): Promise<ItemJourney> {
      await assertStoryIsWritable(db, itemJourneyData.storyId);
      const newItemJourney: ItemJourney = {
        ...itemJourneyData,
        id: createULID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      };

      await db.insert(itemJourneys).values(newItemJourney).run();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newItemJourney.storyId,
        userId,
      );
      await recordLocalOperation(
        db,
        newItemJourney.storyId,
        userIdToLog,
        'create',
        OperationLogEntityType.ItemJourney,
        newItemJourney.id,
        newItemJourney,
      );
      entityEventEmitter.emit('item_journey_changed', newItemJourney.storyId, newItemJourney.id);

      return newItemJourney;
    },

    async updateItemJourney(
      userId: string,
      id: string,
      itemJourneyData: Partial<
        Omit<
          ItemJourney,
          | 'id'
          | 'storyId'
          | 'itemId'
          | 'createdAt'
          | 'updatedAt'
          | 'version'
          | 'isDeleted'
          | 'deletedAt'
        >
      >,
    ): Promise<ItemJourney> {
      const originalItemJourney = await db.query.itemJourneys.findFirst({
        where: eq(itemJourneys.id, id),
      });
      if (!originalItemJourney) {
        throw new Error(`ItemJourney with ID ${id} not found for update.`);
      }
      await assertStoryIsWritable(db, originalItemJourney.storyId);

      const updatedItemJourney = await db
        .update(itemJourneys)
        .set({
          ...itemJourneyData,
          updatedAt: new Date(),
          version: sql`${itemJourneys.version} + 1`,
        })
        .where(and(eq(itemJourneys.id, id), eq(itemJourneys.isDeleted, false)))
        .returning()
        .get();

      if (!updatedItemJourney) {
        throw new Error(`ItemJourney with ID ${id} not found or already deleted.`);
      }

      const changes = getChangedFields(originalItemJourney, updatedItemJourney);
      if (Object.keys(changes).length > 0) {
        const userIdToLog = await getUserIdForOperation(
          db,
          serverService,
          updatedItemJourney.storyId,
          userId,
        );
        await recordLocalOperation(
          db,
          updatedItemJourney.storyId,
          userIdToLog,
          'update',
          OperationLogEntityType.ItemJourney,
          updatedItemJourney.id,
          changes,
        );
      }
      entityEventEmitter.emit(
        'item_journey_changed',
        updatedItemJourney.storyId,
        updatedItemJourney.id,
      );

      return updatedItemJourney;
    },

    async deleteItemJourney(userId: string, id: string): Promise<void> {
      const itemJourneyToDelete = await db.query.itemJourneys.findFirst({
        where: eq(itemJourneys.id, id),
      });
      if (!itemJourneyToDelete) {
        console.warn(`Attempted to delete non-existent ItemJourney ${id}.`);
        return;
      }
      await assertStoryIsWritable(db, itemJourneyToDelete.storyId);

      const [removed] = await db
        .update(itemJourneys)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${itemJourneys.version} + 1`,
        })
        .where(eq(itemJourneys.id, id))
        .returning({ id: itemJourneys.id, version: itemJourneys.version });

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        itemJourneyToDelete.storyId,
        userId,
      );
      await recordLocalOperation(
        db,
        itemJourneyToDelete.storyId,
        userIdToLog,
        'delete',
        OperationLogEntityType.ItemJourney,
        id,
        { id, version: removed?.version },
      );
      entityEventEmitter.emit('item_journey_changed', itemJourneyToDelete.storyId, id);
    },
  };
};
