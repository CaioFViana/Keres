import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { characters, db, gallery, locations, notes, story } from '@infrastructure/db' // Import db and gallery table
import { and, eq, or, sql, ilike } from 'drizzle-orm'

export class GalleryRepository implements IGalleryRepository {
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

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Gallery>> {
    try {
      let baseQuery = db.select().from(gallery).where(eq(gallery.storyId, storyId));

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(gallery.storyId, storyId), eq(gallery.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'imagePath':
                baseQuery = baseQuery.where(and(eq(gallery.storyId, storyId), ilike(gallery.imagePath, `%${value}%`)));
                break;
              case 'ownerType':
                baseQuery = baseQuery.where(and(eq(gallery.storyId, storyId), eq(gallery.ownerType, value)));
                break;
              case 'extraNotes':
                baseQuery = baseQuery.where(and(eq(gallery.storyId, storyId), ilike(gallery.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(gallery)
        .where(eq(gallery.storyId, storyId));

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(gallery.storyId, storyId), eq(gallery.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'imagePath':
                countQuery = countQuery.where(and(eq(gallery.storyId, storyId), ilike(gallery.imagePath, `%${value}%`)));
                break;
              case 'ownerType':
                countQuery = countQuery.where(and(eq(gallery.storyId, storyId), eq(gallery.ownerType, value)));
                break;
              case 'extraNotes':
                countQuery = countQuery.where(and(eq(gallery.storyId, storyId), ilike(gallery.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Apply pagination to the main query
      let finalQuery = baseQuery;
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
      console.error('Error in GalleryRepository.findByStoryId:', error);
      throw error;
    }
  }

  async findByOwnerId(
    ownerId: string,
    userId: string,
    query?: ListQueryParams,
  ): Promise<PaginatedResponse<Gallery>> {
    try {
      let baseQuery = db.select().from(gallery).where(eq(gallery.ownerId, ownerId));

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(gallery.ownerId, ownerId), eq(gallery.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'imagePath':
                baseQuery = baseQuery.where(and(eq(gallery.ownerId, ownerId), ilike(gallery.imagePath, `%${value}%`)));
                break;
              case 'ownerType':
                baseQuery = baseQuery.where(and(eq(gallery.ownerId, ownerId), eq(gallery.ownerType, value)));
                break;
              case 'extraNotes':
                baseQuery = baseQuery.where(and(eq(gallery.ownerId, ownerId), ilike(gallery.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Apply joins and user filter to the base query
      baseQuery = baseQuery
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
        .where(eq(story.userId, userId));

      // Build the count query based on the same filters and joins
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(gallery)
        .where(eq(gallery.ownerId, ownerId));

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(gallery.ownerId, ownerId), eq(gallery.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'imagePath':
                countQuery = countQuery.where(and(eq(gallery.ownerId, ownerId), ilike(gallery.imagePath, `%${value}%`)));
                break;
              case 'ownerType':
                countQuery = countQuery.where(and(eq(gallery.ownerId, ownerId), eq(gallery.ownerType, value)));
                break;
              case 'extraNotes':
                countQuery = countQuery.where(and(eq(gallery.ownerId, ownerId), ilike(gallery.extraNotes, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      countQuery = countQuery
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
        .where(eq(story.userId, userId));

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Apply pagination to the main query
      let finalQuery = baseQuery;
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(
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
      );

      return { items, totalItems };
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
      ownerId: data.ownerId,
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
