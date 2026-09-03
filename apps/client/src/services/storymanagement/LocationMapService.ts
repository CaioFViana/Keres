import type { LocationMapContentType } from '@keres/shared';
import { validateLocationMapContent } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { LocationMapInsert, LocationMapSelect } from '../../db/schema';
import { locationMaps } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export interface LocationMapService {
  getMapsForStory(storyId: string): Promise<LocationMapSelect[]>;
  getById(mapId: string): Promise<LocationMapSelect | undefined>;
  createMap(currentUserId: string, data: Create<LocationMapInsert>): Promise<LocationMapSelect>;
  updateMap(
    currentUserId: string,
    mapId: string,
    changes: Partial<{
      name: string;
      description: string | null;
      content: LocationMapContentType;
    }>,
  ): Promise<LocationMapSelect>;
  deleteMap(currentUserId: string, mapId: string): Promise<void>;
}

export const createLocationMapService = (db: AppDrizzleClient): LocationMapService => {
  const serverService = createServerService(db);

  const liveInStory = (storyId: string) =>
    and(eq(locationMaps.storyId, storyId), eq(locationMaps.isDeleted, false));

  const logOperation = async (
    currentUserId: string,
    storyId: string,
    type: 'create' | 'update' | 'delete',
    mapId: string,
    payload: Record<string, unknown>,
  ) => {
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await recordLocalOperation(db, storyId, userIdToLog, type, 'LocationMap', mapId, payload);
    entityEventEmitter.emit('location_map_changed', storyId, mapId);
  };

  return {
    async getMapsForStory(storyId) {
      return db
        .select()
        .from(locationMaps)
        .where(liveInStory(storyId))
        .orderBy(asc(locationMaps.name))
        .all();
    },

    async getById(mapId) {
      return db.query.locationMaps.findFirst({ where: eq(locationMaps.id, mapId) });
    },

    async createMap(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const content = validateLocationMapContent(data.content ?? { images: [], nodes: [] });
      const map = prepareNewEntityData<LocationMapInsert>({ ...data, content });
      const result = await db.insert(locationMaps).values(map).returning().get();
      await logOperation(currentUserId, map.storyId, 'create', map.id, { ...result });
      return result;
    },

    async updateMap(currentUserId, mapId, changes) {
      const original = await db.query.locationMaps.findFirst({ where: eq(locationMaps.id, mapId) });
      if (!original) throw new Error(`Location map with ID ${mapId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);

      const nextContent =
        changes.content !== undefined ? validateLocationMapContent(changes.content) : undefined;
      const normalised = {
        ...changes,
        ...(nextContent !== undefined ? { content: nextContent } : {}),
      };
      const changed = getChangedFields(original, { ...original, ...normalised });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      await db
        .update(locationMaps)
        .set({ ...normalised, updatedAt: new Date(), version: sql`${locationMaps.version} + 1` })
        .where(eq(locationMaps.id, mapId));

      const updated = await db.query.locationMaps.findFirst({ where: eq(locationMaps.id, mapId) });
      if (!updated) throw new Error(`Failed to retrieve updated LocationMap ${mapId}.`);

      const operationChanges = getChangedFields(original, updated);
      // The map content is a single validated JSON document. It must travel whole: the generic
      // object diff would otherwise omit an unchanged required collection (`images` or `nodes`).
      if (operationChanges.content !== undefined) {
        operationChanges.content = updated.content;
      }

      await logOperation(currentUserId, updated.storyId, 'update', mapId, operationChanges);
      return updated;
    },

    async deleteMap(currentUserId, mapId) {
      const original = await db.query.locationMaps.findFirst({ where: eq(locationMaps.id, mapId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent location map ${mapId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);

      const [updated] = await db
        .update(locationMaps)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${locationMaps.version} + 1`,
        })
        .where(eq(locationMaps.id, mapId))
        .returning({
          id: locationMaps.id,
          storyId: locationMaps.storyId,
          isDeleted: locationMaps.isDeleted,
          version: locationMaps.version,
        });

      if (!updated) throw new Error(`Failed to delete location map ${mapId}.`);

      await logOperation(currentUserId, updated.storyId, 'delete', mapId, {
        id: updated.id,
        isDeleted: updated.isDeleted,
        version: updated.version,
      });
    },
  };
};
