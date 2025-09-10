import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { db, locations, locationTags, story } from '@infrastructure/db' // Import db and locations table
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm'

export class LocationRepository implements ILocationRepository {
  async findById(id: string): Promise<Location | null> {
    try {
      const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in LocationRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Location>> {
    try {
      let baseQuery = db.select().from(locations).where(eq(locations.storyId, storyId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        name: locations.name,
        description: locations.description,
        climate: locations.climate,
        culture: locations.culture,
        politics: locations.politics,
        isFavorite: locations.isFavorite,
        // Add other filterable fields here
      }

      // Apply hasTags filter
      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',');
        baseQuery = baseQuery
          .leftJoin(locationTags, eq(locations.id, locationTags.locationId))
          .where(and(eq(locations.storyId, storyId), inArray(locationTags.tagId, tagIds)));
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(
                and(eq(locations.storyId, storyId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(locations)
        .where(eq(locations.storyId, storyId)); // Start with the base where clause

      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',');
        countQuery = countQuery
          .leftJoin(locationTags, eq(locations.id, locationTags.locationId))
          .where(and(eq(locations.storyId, storyId), inArray(locationTags.tagId, tagIds)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(locations.storyId, storyId), eq(column, value)),
              );
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Sorting (Revised)
      const sortableFields = {
        name: locations.name,
        createdAt: locations.createdAt,
        updatedAt: locations.updatedAt,
        // Add other sortable fields here
      }
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in LocationRepository.findByStoryId:', error);
      throw error;
    }
  }

  async save(locationData: Location): Promise<void> {
    try {
      await db.insert(locations).values(this.toPersistence(locationData))
    } catch (error) {
      console.error('Error in LocationRepository.save:', error)
      throw error
    }
  }

  async update(locationData: Location, storyId: string): Promise<void> {
    try {
      await db
        .update(locations)
        .set(this.toPersistence(locationData))
        .where(eq(locations.id, locationData.id), eq(locations.storyId, storyId))
    } catch (error) {
      console.error('Error in LocationRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(locations).where(eq(locations.id, id), eq(locations.storyId, storyId))
    } catch (error) {
      console.error('Error in LocationRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof locations.$inferSelect): Location {
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      description: data.description,
      climate: data.climate,
      culture: data.culture,
      politics: data.politics,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(locationData: Location): typeof locations.$inferInsert {
    return {
      id: locationData.id,
      storyId: locationData.storyId,
      name: locationData.name,
      description: locationData.description,
      climate: locationData.climate,
      culture: locationData.culture,
      politics: locationData.politics,
      isFavorite: locationData.isFavorite,
      extraNotes: locationData.extraNotes,
      createdAt: locationData.createdAt,
      updatedAt: locationData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Location[]> {
    try {
      const results = await db
        .select({ locations: locations })
        .from(locations)
        .innerJoin(story, eq(locations.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(
              like(locations.name, `%${query}%`),
              like(locations.description, `%${query}%`),
              like(locations.climate, `%${query}%`),
              like(locations.culture, `%${query}%`),
              like(locations.politics, `%${query}%`),
              like(locations.extraNotes, `%${query}%`),
            ),
          ),
        )
      return results.map((result: { locations: Location }) => this.toDomain(result.locations))
    } catch (error) {
      console.error('Error in LocationRepository.search:', error)
      throw error
    }
  }
}
