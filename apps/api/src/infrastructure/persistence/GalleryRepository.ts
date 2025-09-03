import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'

import { db, gallery } from '@keres/db' // Import db and gallery table
import { eq } from 'drizzle-orm'

export class GalleryRepository implements IGalleryRepository {
  constructor() {
    
  }

  async findById(id: string): Promise<Gallery | null> {
    
    try {
      const result = await db.select().from(gallery).where(eq(gallery.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in GalleryRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Gallery[]> {
    
    try {
      const results = await db.select().from(gallery).where(eq(gallery.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in GalleryRepository.findByStoryId:', error)
      throw error
    }
  }

  async findByOwnerId(ownerId: string): Promise<Gallery[]> {
    
    try {
      const results = await db.select().from(gallery).where(eq(gallery.ownerId, ownerId))
      return results.map(this.toDomain)
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

  async update(galleryData: Gallery): Promise<void> {
    
    try {
      await db
        .update(gallery)
        .set(this.toPersistence(galleryData))
        .where(eq(gallery.id, galleryData.id))
    } catch (error) {
      console.error('Error in GalleryRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    
    try {
      await db.delete(gallery).where(eq(gallery.id, id))
    } catch (error) {
      console.error('Error in GalleryRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof gallery.$inferSelect): Gallery {
    
    return {
      id: data.id,
      storyId: data.storyId,
      ownerId: data.ownerId,
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
