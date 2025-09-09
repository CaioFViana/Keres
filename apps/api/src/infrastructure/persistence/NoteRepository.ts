import type { Note } from '@domain/entities/Note'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { ListQueryParams } from '@keres/shared'

import { db, notes, story } from '@keres/db' // Import db, notes and stories table
import { and, asc, desc, eq, like, or } from 'drizzle-orm'

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

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<Note[]> {
    try {
      let queryBuilder = db.select().from(notes).where(eq(notes.storyId, storyId))

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        title: notes.title,
        body: notes.body,
        isFavorite: notes.isFavorite,
        // Add other filterable fields here
      }

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        // Add other sortable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.prototype.hasOwnProperty.call(query.filter, key)) {
            const value = query.filter[key]
            const column = filterableFields[key as keyof typeof filterableFields]
            if (column) {
              queryBuilder = queryBuilder.where(and(eq(notes.storyId, storyId), eq(column, value)))
            }
          }
        }
      }

      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields]
        if (sortColumn) {
          if (query.order === 'desc') {
            queryBuilder = queryBuilder.orderBy(desc(sortColumn))
          } else {
            queryBuilder = queryBuilder.orderBy(asc(sortColumn))
          }
        }
      }

      // Pagination
      if (query?.limit) {
        queryBuilder = queryBuilder.limit(query.limit)
        if (query.page) {
          const offset = (query.page - 1) * query.limit
          queryBuilder = queryBuilder.offset(offset)
        }
      }

      const results = await queryBuilder
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in NoteRepository.findByStoryId:', error)
      throw error
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
            or(
              like(notes.title, `%${query}%`),
              like(notes.body, `%${query}%`),
            ),
          ),
        )
      return results.map((result: {notes: Note}) => this.toDomain(result.notes))
    } catch (error) {
      console.error('Error in NoteRepository.search:', error)
      throw error
    }
  }
}
