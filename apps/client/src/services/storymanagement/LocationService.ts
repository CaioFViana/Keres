import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { LocationInsert, LocationSelect, TagSelect } from '../../db/schema';
import { locationRelations, locations, tagRelations, tags } from '../../db/schema'; // Import LocationInsert and locations
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

export type LocationWithTags = LocationSelect & { tags: TagSelect[] };

export type { FavoriteFilterState };

export interface LocationService {
  getLocationsByStoryId(
    storyId: string,
    searchTerm?: string,
    tagFilterIds?: string[],
    favoriteFilterState?: FavoriteFilterState,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc',
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<LocationWithTags[]>;
  getLocationCount(storyId?: string): Promise<number>;
  createLocation(
    currentUserId: string,
    locationData: Create<LocationInsert>,
  ): Promise<LocationSelect>;
  updateLocation(
    currentUserId: string,
    locationId: string,
    updatedFields: Partial<Omit<LocationSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
  ): Promise<LocationSelect>;
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
      advancedSearchCriteria,
    ): Promise<LocationWithTags[]> {
      const whereConditions = [eq(locations.storyId, storyId), eq(locations.isDeleted, false)];
      const orderByConditions: any[] = [];

      if (searchTerm) {
        whereConditions.push(
          or(
            sql`${locations.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`,
            sql`${locations.description} LIKE ${`%${searchTerm}%`} COLLATE NOCASE`,
          ) as SQL<boolean>,
        );
      }

      if (tagFilterIds && tagFilterIds.length > 0) {
        const taggedLocations = db
          .select({ entityId: tagRelations.relationId })
          .from(tagRelations)
          .where(
            and(
              eq(tagRelations.relationType, 'Location'),
              inArray(tagRelations.tagId, tagFilterIds),
            ),
          );
        whereConditions.push(inArray(locations.id, taggedLocations));
      }

      if (favoriteFilterState === 'favorite') {
        whereConditions.push(eq(locations.isFavorite, true));
      } else if (favoriteFilterState === 'not-favorite') {
        whereConditions.push(eq(locations.isFavorite, false));
      }

      if (advancedSearchCriteria) {
        whereConditions.push(
          ...(await buildAdvancedSearchConditions(
            'Location',
            locations,
            advancedSearchCriteria,
            async (field, value) => {
              const condition = await buildCustomAttributeSearchCondition(
                db,
                locations.id,
                field,
                value,
              );
              if (!condition) {
                console.warn(`No metadata found for advanced search field: ${field}`);
              }
              return condition;
            },
          )),
        );
      }

      const finalWhereConditions = and(...whereConditions);

      let baseQuery = db
        .select({
          location: locations,
          tag: tags,
        })
        .from(locations)
        .leftJoin(
          tagRelations,
          and(eq(locations.id, tagRelations.relationId), eq(tagRelations.relationType, 'Location')),
        )
        .leftJoin(tags, eq(tagRelations.tagId, tags.id))
        .where(finalWhereConditions)
        .$dynamic();

      switch (sortBy) {
        case 'name':
          orderByConditions.push(
            sortDirection === 'desc' ? desc(locations.name) : asc(locations.name),
          );
          break;
        case 'createdAt':
          orderByConditions.push(
            sortDirection === 'desc' ? desc(locations.createdAt) : asc(locations.createdAt),
          );
          break;
        case 'updatedAt':
          orderByConditions.push(
            sortDirection === 'desc' ? desc(locations.updatedAt) : asc(locations.updatedAt),
          );
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
      return countActiveStoryEntities(db, locations, storyId);
    },

    async createLocation(
      currentUserId: string,
      locationData: Create<LocationInsert>,
    ): Promise<LocationSelect> {
      await assertStoryIsWritable(db, locationData.storyId);
      let newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const favorite = await normalizeFavoriteCreate(
        db,
        newLocation.storyId,
        'Location',
        newLocation,
      );
      newLocation = favorite.data;
      const result = await db.insert(locations).values(newLocation).returning().get();
      await persistInitialFavorite(
        db,
        newLocation.storyId,
        newLocation.id,
        'Location',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newLocation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newLocation.storyId,
        userIdToLog,
        'create',
        'Location',
        newLocation.id,
        { ...result },
      );
      entityEventEmitter.emit('location_changed', newLocation.storyId, newLocation.id);

      return result;
    },

    async updateLocation(
      currentUserId: string,
      locationId: string,
      updatedFields: Partial<Omit<LocationSelect, 'id' | 'createdAt' | 'updatedAt' | 'version'>>,
    ): Promise<LocationSelect> {
      const oldLocation = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });
      if (!oldLocation) {
        throw new Error(`Location with ID ${locationId} not found for update.`);
      }
      await assertStoryIsWritable(db, oldLocation.storyId);
      updatedFields = await normalizeFavoriteUpdate(
        db,
        oldLocation.storyId,
        locationId,
        'Location',
        currentUserId,
        updatedFields,
      );

      const potentialNewState = { ...oldLocation, ...updatedFields };
      const changes = getChangedFields(oldLocation, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for location ${locationId}. Skipping update and operation log.`,
        );
        return oldLocation;
      }

      await db
        .update(locations)
        .set({ ...updatedFields, updatedAt: new Date(), version: sql`${locations.version} + 1` })
        .where(eq(locations.id, locationId))
        .run();

      const updatedLocation = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });
      if (!updatedLocation) {
        throw new Error(`Failed to retrieve updated location ${locationId}.`);
      }

      const changedFields = getChangedFields(oldLocation, updatedLocation);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedLocation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedLocation.storyId,
        userIdToLog,
        'update',
        'Location',
        locationId,
        changedFields,
      );
      entityEventEmitter.emit('location_changed', updatedLocation.storyId, updatedLocation.id);

      return updatedLocation;
    },

    async deleteLocation(currentUserId: string, locationId: string): Promise<void> {
      const locationToDelete = await db.query.locations.findFirst({
        where: eq(locations.id, locationId),
      });
      if (!locationToDelete) {
        console.warn(`Attempted to delete non-existent location ${locationId}.`);
        return;
      }
      await assertStoryIsWritable(db, locationToDelete.storyId);

      const [updatedLocation] = await db
        .update(locations)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${locations.version} + 1`,
        })
        .where(eq(locations.id, locationId))
        .returning({
          id: locations.id,
          storyId: locations.storyId,
          isDeleted: locations.isDeleted,
          version: locations.version,
        });

      if (!updatedLocation) {
        throw new Error(`Failed to delete location ${locationId} or location not found.`);
      }

      const changedFields = {
        id: updatedLocation.id,
        isDeleted: updatedLocation.isDeleted,
        version: updatedLocation.version,
      };

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedLocation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedLocation.storyId,
        userIdToLog,
        'delete',
        'Location',
        locationId,
        changedFields,
      );
      entityEventEmitter.emit('location_changed', updatedLocation.storyId, updatedLocation.id);

      // A cascade: a LocationRelation pointing at a deleted Location has nowhere to
      // navigate - unlike the other reverse relations in this file (LocationCharacterManager
      // etc.), which are left orphaned inertly without a problem. Each relation needs its OWN
      // operation recorded (not a direct SQL mutation) so that other devices' pull
      // learns of the deletion - the same reason as the AttributeValue cascade in StorySchemaFieldService.
      const liveRelations = await db
        .select({ id: locationRelations.id, version: locationRelations.version })
        .from(locationRelations)
        .where(
          and(
            eq(locationRelations.isDeleted, false),
            or(
              eq(locationRelations.locationAId, locationId),
              eq(locationRelations.locationBId, locationId),
            ),
          ),
        )
        .all();

      for (const relation of liveRelations) {
        const [updatedRelation] = await db
          .update(locationRelations)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${locationRelations.version} + 1`,
          })
          .where(eq(locationRelations.id, relation.id))
          .returning({ id: locationRelations.id, version: locationRelations.version });

        if (!updatedRelation) {
          continue;
        }

        await recordLocalOperation(
          db,
          updatedLocation.storyId,
          userIdToLog,
          'delete',
          'LocationRelation',
          relation.id,
          {
            id: relation.id,
            isDeleted: true,
            version: updatedRelation.version,
          },
        );
      }

      if (liveRelations.length > 0) {
        entityEventEmitter.emit('location_relation_changed', updatedLocation.storyId, locationId);
      }
    },

    async getById(locationId: string): Promise<LocationSelect | undefined> {
      const location = await db.query.locations.findFirst({
        where: and(eq(locations.id, locationId), eq(locations.isDeleted, false)),
      });
      return decorateFavorite(db, 'Location', location);
    },

    async getAllByStoryId(storyId: string): Promise<LocationSelect[]> {
      if (!storyId) {
        console.error('getAllByStoryId: storyId is required.');
        return [];
      }
      try {
        const allLocations = await db
          .select()
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
