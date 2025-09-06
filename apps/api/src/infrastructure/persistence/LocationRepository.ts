import type { Location } from '@domain/entities/Location'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository'
import type { ListQueryParams } from '@keres/shared'

import { db, locations, locationTags } from '@keres/db' // Import db and locations table
import { and, eq, inArray } from 'drizzle-orm'

export class LocationRepository implements ILocationRepository {
  constructor() {}

  async findById(id: string): Promise<Location | null> {
    try {
      const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in LocationRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<Location[]> {
    try {
      let queryBuilder = db.select().from(locations).where(eq(locations.storyId, storyId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(locations.storyId, storyId), eq(locations.isFavorite, query.isFavorite)),
        )
      }

      if (query?.hasTags) {
        const tagIds = query.hasTags.split(',')
        queryBuilder = queryBuilder
          .leftJoin(locationTags, eq(locations.id, locationTags.locationId))
          .where(and(eq(locations.storyId, storyId), inArray(locationTags.tagId, tagIds)))
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in LocationRepository.findByStoryId:', error)
      throw error
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
}
