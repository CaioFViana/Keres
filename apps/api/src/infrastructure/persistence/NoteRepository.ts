import type { Note } from '@domain/entities/Note'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { db, notes, story } from '@infrastructure/db' // Import db, notes and stories table
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

export class NoteRepository implements INoteRepository {
  async findById(id: string): Promise<Note | null> {
    try {
      const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in NoteRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Note>> {
    try {
      let baseQuery = db.select().from(notes).where(eq(notes.storyId, storyId));

      // Apply isFavorite filter directly
      if (query?.isFavorite !== undefined) {
        baseQuery = baseQuery.where(and(eq(notes.storyId, storyId), eq(notes.isFavorite, query.isFavorite)));
      }

      // Apply generic filters
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'title':
                baseQuery = baseQuery.where(and(eq(notes.storyId, storyId), ilike(notes.title, `%${value}%`)));
                break;
              case 'body':
                baseQuery = baseQuery.where(and(eq(notes.storyId, storyId), ilike(notes.body, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(eq(notes.storyId, storyId)); // Start with the base where clause

      // Apply isFavorite filter directly to count query
      if (query?.isFavorite !== undefined) {
        countQuery = countQuery.where(and(eq(notes.storyId, storyId), eq(notes.isFavorite, query.isFavorite)));
      }

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            switch (key) {
              case 'title':
                countQuery = countQuery.where(and(eq(notes.storyId, storyId), ilike(notes.title, `%${value}%`)));
                break;
              case 'body':
                countQuery = countQuery.where(and(eq(notes.storyId, storyId), ilike(notes.body, `%${value}%`)));
                break;
              // Add other filterable fields here as needed
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
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
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
      console.error('Error in NoteRepository.findByStoryId:', error);
      throw error;
    }
  }

  async findByGalleryId(galleryId: string): Promise<Note[]> {
    try {
      const results = await db.select().from(notes).where(eq(notes.galleryId, galleryId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in NoteRepository.findByGalleryId:', error)
      throw error
    }
  }

  async save(noteData: Note): Promise<void> {
    try {
      await db.insert(notes).values(this.toPersistence(noteData))
    } catch (error) {
      console.error('Error in NoteRepository.save:', error)
      throw error
    }
  }

  async update(noteData: Note, storyId: string): Promise<void> {
    try {
      await db
        .update(notes)
        .set(this.toPersistence(noteData))
        .where(eq(notes.id, noteData.id), eq(notes.storyId, storyId))
    } catch (error) {
      console.error('Error in NoteRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(notes).where(eq(notes.id, id), eq(notes.storyId, storyId))
    } catch (error) {
      console.error('Error in NoteRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof notes.$inferSelect): Note {
    return {
      id: data.id,
      storyId: data.storyId,
      title: data.title,
      body: data.body,
      galleryId: data.galleryId,
      isFavorite: data.isFavorite,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(noteData: Note): typeof notes.$inferInsert {
    return {
      id: noteData.id,
      storyId: noteData.storyId,
      title: noteData.title,
      body: noteData.body,
      galleryId: noteData.galleryId,
      isFavorite: noteData.isFavorite,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Note[]> {
    try {
      const results = await db
        .select({ notes: notes })
        .from(notes)
        .innerJoin(story, eq(notes.storyId, story.id))
        .where(
          and(
            eq(story.userId, userId),
            or(ilike(notes.title, `%${query}%`), ilike(notes.body, `%${query}%`)),
          ),
        )
      return results.map((result: { notes: Note }) => this.toDomain(result.notes))
    } catch (error) {
      console.error('Error in NoteRepository.search:', error)
      throw error
    }
  }
}
