import type { Note } from '@domain/entities/Note'
import type { INoteRepository } from '@domain/repositories/INoteRepository'

import { db, notes } from '@keres/db' // Import db and notes table
import { eq } from 'drizzle-orm'

export class NoteRepository implements INoteRepository {
  constructor() {
    
  }

  async findById(id: string): Promise<Note | null> {
    
    try {
      const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in NoteRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Note[]> {
    
    try {
      const results = await db.select().from(notes).where(eq(notes.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in NoteRepository.findByStoryId:', error)
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

  async update(noteData: Note): Promise<void> {
    
    try {
      await db.update(notes).set(this.toPersistence(noteData)).where(eq(notes.id, noteData.id))
    } catch (error) {
      console.error('Error in NoteRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    
    try {
      await db.delete(notes).where(eq(notes.id, id))
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
}
