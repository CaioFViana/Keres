import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, count, desc, eq, inArray, or, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { locations, LocationInsert, LocationSelect, tagRelations, tags, TagSelect } from '../db/schema'; // Import LocationInsert and locations
import { entityEventEmitter } from '../utils/EventEmitter';
import { getChangedFields } from '../utils/diffUtils';
import { Create, prepareNewEntityData } from '../utils/entityUtils';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';

export type LocationWithTags = LocationSelect & { tags: TagSelect[] };

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export interface LocationService {
  getLocationsByStoryId(storyId: string, searchTerm?: string, tagFilterIds?: string[], favoriteFilterState?: FavoriteFilterState, sortBy?: string, sortDirection?: 'asc' | 'desc', advancedSearchCriteria?: { [key: string]: any }): Promise<LocationWithTags[]>;
  getLocationCount(storyId?: string): Promise<number>;
  createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect>;
  updateLocation(currentUserId: string, locationId: string, updatedFields: Partial<Omit<LocationSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<LocationSelect>;
  deleteLocation(currentUserId: string, locationId: string): Promise<void>;
  getById(locationId: string): Promise<LocationSelect | undefined>;
  getAllByStoryId(storyId: string): Promise<LocationSelect[]>;
}

export const createLocationService = (db: AppDrizzleClient): LocationService => {
  const serverService = createServerService(db);
  return {
    async getLocationsByStoryId(
      storyId,
      searchTerm,
      tagFilterIds,
      favoriteFilterState,
      sortBy,
      sortDirection,
      advancedSearchCriteria
    ): Promise<LocationWithTags[]> {
      const whereConditions = [eq(locations.storyId, storyId), eq(locations.isDeleted, false)];
      const orderByConditions: any[] = [];

      if (searchTerm) {
        whereConditions.push(or(
          sql`${locations.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`,
          sql`${locations.description} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`
        ) as SQL<boolean>);
      }

      if (tagFilterIds && tagFilterIds.length > 0) {
        const taggedLocations = db
          .select({ entityId: tagRelations.relationId })
          .from(tagRelations)
          .where(and(
            eq(tagRelations.relationType, 'Location'),
            inArray(tagRelations.tagId, tagFilterIds)
          ));
        whereConditions.push(inArray(locations.id, taggedLocations));
      }

      if (favoriteFilterState === 'favorite') {
        whereConditions.push(eq(locations.isFavorite, true));
      } else if (favoriteFilterState === 'not-favorite') {
        whereConditions.push(eq(locations.isFavorite, false));
      }

      if (advancedSearchCriteria) {
        const locationMetadata = entityFieldMetadata.Location.filter(m => m.isSearchable);

        for (const key in advancedSearchCriteria) {
          if (advancedSearchCriteria.hasOwnProperty(key)) {
            const value = advancedSearchCriteria[key];
            if (value === undefined || value === null || value === '') continue;

            const fieldMetadata = locationMetadata.find(meta => meta.name === key);

            if (!fieldMetadata) {
              console.warn(`No metadata found for advanced search field: ${key}`);
              continue;
            }

            switch (fieldMetadata.type) {
              case 'string':
              case 'id':
                whereConditions.push(sql`${(locations as any)[key]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
                break;
              case 'boolean':
                whereConditions.push(eq((locations as any)[key], value));
                break;
              case 'number':
                whereConditions.push(eq((locations as any)[key], Number(value)));
                break;
              case 'date':
                whereConditions.push(sql`${(locations as any)[key]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
                break;
              default:
                console.warn(`Unsupported field type for advanced search: ${fieldMetadata.type}`);
                break;
            }
          }
        }
      }

      const finalWhereConditions = and(...whereConditions);

      let baseQuery = db.select({
        location: locations,
        tag: tags,
      })
        .from(locations)
        .leftJoin(tagRelations, and(
          eq(locations.id, tagRelations.relationId),
          eq(tagRelations.relationType, 'Location')
        ))
        .leftJoin(tags, eq(tagRelations.tagId, tags.id))
        .where(finalWhereConditions)
        .$dynamic();

      switch (sortBy) {
        case 'name':
          orderByConditions.push(sortDirection === 'desc' ? desc(locations.name) : asc(locations.name));
          break;
        case 'createdAt':
          orderByConditions.push(sortDirection === 'desc' ? desc(locations.createdAt) : asc(locations.createdAt));
          break;
        case 'updatedAt':
          orderByConditions.push(sortDirection === 'desc' ? desc(locations.updatedAt) : asc(locations.updatedAt));
          break;
        default:
          orderByConditions.push(asc(locations.name));
          break;
      }

      if (orderByConditions.length > 0) {
        baseQuery = baseQuery.orderBy(...orderByConditions);
      }

      const result = await baseQuery.all();

      const locationMap = new Map<string, LocationWithTags>();

      for (const row of result) {
        if (row.location) {
          if (!locationMap.has(row.location.id)) {
            locationMap.set(row.location.id, { ...row.location, tags: [] });
          }
          if (row.tag) {
            if (!(row.tag as TagSelect).isDeleted) {
              locationMap.get(row.location.id)?.tags.push(row.tag as TagSelect);
            }
          }
        }
      }

      return Array.from(locationMap.values());
    },

    async getLocationCount(storyId?: string): Promise<number> {
      const whereConditions = [eq(locations.isDeleted, false)];
      if (storyId) {
        whereConditions.push(eq(locations.storyId, storyId));
      }
      const result = await db.select({ count: count() }).from(locations)
        .where(and(...whereConditions))
        .get();
      return result?.count || 0;
    },

    async createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect> {
      const newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const result = await db.insert(locations).values(newLocation).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newLocation.storyId, currentUserId);
      await recordLocalOperation(db, newLocation.storyId, userIdToLog, 'create', 'Location', newLocation.id, { ...result });
      entityEventEmitter.emit('location_changed', newLocation.storyId, newLocation.id);

      return result;
    },

    async updateLocation(currentUserId: string, locationId: string, updatedFields: Partial<Omit<LocationSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>): Promise<LocationSelect> {
      const oldLocation = await db.query.locations.findFirst({ where: eq(locations.id, locationId) });
      if (!oldLocation) {
        throw new Error(`Location with ID ${locationId} not found for update.`);
      }

      const potentialNewState = { ...oldLocation, ...updatedFields };
      const changes = getChangedFields(oldLocation, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(`No significant changes detected for location ${locationId}. Skipping update and operation log.`);
        return oldLocation;
      }

      await db.update(locations)
        .set({ ...updatedFields, updatedAt: new Date(), version: sql`${locations.version} + 1` })
        .where(eq(locations.id, locationId))
        .run();

      const updatedLocation = await db.query.locations.findFirst({ where: eq(locations.id, locationId) });
      if (!updatedLocation) {
        throw new Error(`Failed to retrieve updated location ${locationId}.`);
      }

      const changedFields = getChangedFields(oldLocation, updatedLocation);

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedLocation.storyId, currentUserId);
      await recordLocalOperation(db, updatedLocation.storyId, userIdToLog, 'update', 'Location', locationId, changedFields);
      entityEventEmitter.emit('location_changed', updatedLocation.storyId, updatedLocation.id);

      return updatedLocation;
    },

    async deleteLocation(currentUserId: string, locationId: string): Promise<void> {
      const locationToDelete = await db.query.locations.findFirst({ where: eq(locations.id, locationId) });
      if (!locationToDelete) {
        console.warn(`Attempted to delete non-existent location ${locationId}.`);
        return;
      }

      const [updatedLocation] = await db.update(locations)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${locations.version} + 1` })
        .where(eq(locations.id, locationId))
        .returning({ id: locations.id, storyId: locations.storyId, isDeleted: locations.isDeleted, version: locations.version });

      if (!updatedLocation) {
        throw new Error(`Failed to delete location ${locationId} or location not found.`);
      }

      const changedFields = {
        id: updatedLocation.id,
        isDeleted: updatedLocation.isDeleted,
        version: updatedLocation.version,
      };

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedLocation.storyId, currentUserId);
      await recordLocalOperation(db, updatedLocation.storyId, userIdToLog, 'delete', 'Location', locationId, changedFields);
      entityEventEmitter.emit('location_changed', updatedLocation.storyId, updatedLocation.id);
    },

    async getById(locationId: string): Promise<LocationSelect | undefined> {
        const location = await db.query.locations.findFirst({
            where: and(eq(locations.id, locationId), eq(locations.isDeleted, false)),
        });
        return location;
    },

    async getAllByStoryId(storyId: string): Promise<LocationSelect[]> {
        if (!storyId) {
            console.error('getAllByStoryId: storyId is required.');
            return [];
        }
        try {
            const allLocations = await db.select()
                .from(locations)
                .where(and(eq(locations.storyId, storyId), eq(locations.isDeleted, false)))
                .all();
            return allLocations;
        } catch (error) {
            console.error(`Error fetching all locations for story ${storyId}:`, error);
            return [];
        }
    },
  };
};