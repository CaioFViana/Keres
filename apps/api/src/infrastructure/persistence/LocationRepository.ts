import { eq } from 'drizzle-orm';
import { db } from '@keres/db';
import { locations } from '@keres/db/src/schema';
import { Location } from '@domain/entities/Location';
import { ILocationRepository } from '@domain/repositories/ILocationRepository';

export class LocationRepository implements ILocationRepository {
  constructor() {
    console.log('LocationRepository constructor called.');
  }

  async findById(id: string): Promise<Location | null> {
    console.log('LocationRepository.findById called.');
    try {
      const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in LocationRepository.findById:', error);
      throw error;
    }
  }

  async findByStoryId(storyId: string): Promise<Location[]> {
    console.log('LocationRepository.findByStoryId called.');
    try {
      const results = await db.select().from(locations).where(eq(locations.storyId, storyId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in LocationRepository.findByStoryId:', error);
      throw error;
    }
  }

  async save(locationData: Location): Promise<void> {
    console.log('LocationRepository.save called.');
    try {
      await db.insert(locations).values(this.toPersistence(locationData));
    } catch (error) {
      console.error('Error in LocationRepository.save:', error);
      throw error;
    }
  }

  async update(locationData: Location): Promise<void> {
    console.log('LocationRepository.update called.');
    try {
      await db.update(locations).set(this.toPersistence(locationData)).where(eq(locations.id, locationData.id));
    } catch (error) {
      console.error('Error in LocationRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('LocationRepository.delete called.');
    try {
      await db.delete(locations).where(eq(locations.id, id));
    } catch (error) {
      console.error('Error in LocationRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof locations.$inferSelect): Location {
    console.log('LocationRepository.toDomain called.');
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
    };
  }

  private toPersistence(locationData: Location): typeof locations.$inferInsert {
    console.log('LocationRepository.toPersistence called.');
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
    };
  }
}
