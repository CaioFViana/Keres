import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ListQueryParams } from '@keres/shared'

import { characters, db, gallery, locations, notes, story } from '@keres/db' // Import db and gallery table
import { and, eq, or, sql } from 'drizzle-orm'

export class GalleryRepository implements IGalleryRepository {
  constructor() {}

  async findById(id: string): Promise<Gallery | null> {
    try {
      const result = await db.select().from(gallery).where(eq(gallery.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in GalleryRepository.findById:', error)
      throw error
    }
  }

  async findByImagePathAndStoryId(imagePath: string, storyId: string): Promise<Gallery | null> {
    try {
      const result = await db
        .select()
        .from(gallery)
        .where(and(eq(gallery.imagePath, imagePath), eq(gallery.storyId, storyId)))
        .limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in GalleryRepository.findByImagePathAndStoryId:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<Gallery[]> {
    try {
      let queryBuilder = db.select().from(gallery).where(eq(gallery.storyId, storyId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(gallery.storyId, storyId), eq(gallery.isFavorite, query.isFavorite)),
        )
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in GalleryRepository.findByStoryId:', error)
      throw error
    }
  }

  async findByOwnerId(
    ownerId: string,
    userId: string,
    query?: ListQueryParams,
  ): Promise<Gallery[]> {
    try {
      let queryBuilder = db.select().from(gallery).where(eq(gallery.ownerId, ownerId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(gallery.ownerId, ownerId), eq(gallery.isFavorite, query.isFavorite)),
        )
      }

      // This part is complex due to the polymorphic ownerId.
      // We need to check if the ownerId belongs to a character, note, or location,
      // and then verify if that character/note/location's story belongs to the userId.
      // This might be better handled in the use case or by separate queries.
      // For now, I'll implement a basic join to filter by story ownership.

      // This is a simplified approach. A more robust solution might involve
      // fetching the owner first and then filtering the gallery items.
      const results = await queryBuilder
        .leftJoin(characters, eq(gallery.ownerId, characters.id))
        .leftJoin(notes, eq(gallery.ownerId, notes.id))
        .leftJoin(locations, eq(gallery.ownerId, locations.id))
        .leftJoin(
          story,
          or(
            eq(characters.storyId, story.id),
            eq(notes.storyId, story.id),
            eq(locations.storyId, story.id),
          ),
        )
        .where(eq(story.userId, userId))

      // Auto generated row typing.
      return results.map(
        (row: {
          gallery: {
            id: string
            createdAt: Date
            updatedAt: Date
            isFavorite: boolean
            extraNotes: string | null
            storyId: string
            ownerId: string
            ownerType: 'character' | 'note' | 'location'
            imagePath: string
            isFile: boolean
          }
        }) => this.toDomain(row.gallery),
      )
    } catch (error) {
      console.error('Error in GalleryRepository.findByOwnerId:', error)
      throw error
    }
  }

  async save(galleryData: Gallery): Promise<void> {
    try {
      await db.insert(gallery).values(this.toPersistence(galleryData))
    } catch (error) {
      console.error('Error in GalleryRepository.save:', error)
      throw error
    }
  }

  async update(galleryData: Gallery, storyId: string, ownerId: string): Promise<void> {
    try {
      await db
        .update(gallery)
        .set(this.toPersistence(galleryData))
        .where(
          eq(gallery.id, galleryData.id),
          eq(gallery.storyId, storyId),
          eq(gallery.ownerId, ownerId),
        )
    } catch (error) {
      console.error('Error in GalleryRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string, ownerId: string): Promise<void> {
    try {
      await db
        .delete(gallery)
        .where(eq(gallery.id, id), eq(gallery.storyId, storyId), eq(gallery.ownerId, ownerId))
    } catch (error) {
      console.error('Error in GalleryRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof gallery.$inferSelect): Gallery {
    return {
      id: data.id,
      storyId: data.storyId,
      ownerId: data.ownerId!,
      ownerType: data.ownerType as 'character' | 'note' | 'location',
      imagePath: data.imagePath,
      isFile: data.isFile,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(galleryData: Gallery): typeof gallery.$inferInsert {
    return {
      id: galleryData.id,
      storyId: galleryData.storyId,
      ownerType: galleryData.ownerType as 'character' | 'note' | 'location',
      ownerId: galleryData.ownerId,
      imagePath: galleryData.imagePath,
      isFile: galleryData.isFile,
      isFavorite: galleryData.isFavorite,
      extraNotes: galleryData.extraNotes,
      createdAt: galleryData.createdAt,
      updatedAt: galleryData.updatedAt,
    }
  }
}
