import type { Note } from '@domain/entities/Note';
import type { INoteRepository } from '@domain/repositories/INoteRepository';

import { db, notes } from '@keres/db'; // Import db and notes table
import { eq } from 'drizzle-orm';

export class NoteRepository implements INoteRepository {
  constructor() {
    console.log('NoteRepository constructor called.');
  }

  async findById(id: string): Promise<Note | null> {
    console.log('NoteRepository.findById called.');
    try {
      const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in NoteRepository.findById:', error);
      throw error;
    }
  }

  async findByStoryId(storyId: string): Promise<Note[]> {
    console.log('NoteRepository.findByStoryId called.');
    try {
      const results = await db.select().from(notes).where(eq(notes.storyId, storyId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in NoteRepository.findByStoryId:', error);
      throw error;
    }
  }

  async save(noteData: Note): Promise<void> {
    console.log('NoteRepository.save called.');
    try {
      await db.insert(notes).values(this.toPersistence(noteData));
    } catch (error) {
      console.error('Error in NoteRepository.save:', error);
      throw error;
    }
  }

  async update(noteData: Note): Promise<void> {
    console.log('NoteRepository.update called.');
    try {
      await db.update(notes).set(this.toPersistence(noteData)).where(eq(notes.id, noteData.id));
    } catch (error) {
      console.error('Error in NoteRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('NoteRepository.delete called.');
    try {
      await db.delete(notes).where(eq(notes.id, id));
    } catch (error) {
      console.error('Error in NoteRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof notes.$inferSelect): Note {
    console.log('NoteRepository.toDomain called.');
    return {
      id: data.id,
      storyId: data.storyId,
      title: data.title,
      body: data.body,
      galleryId: data.galleryId,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private toPersistence(noteData: Note): typeof notes.$inferInsert {
    console.log('NoteRepository.toPersistence called.');
    return {
      id: noteData.id,
      storyId: noteData.storyId,
      title: noteData.title,
      body: noteData.body,
      galleryId: noteData.galleryId,
      isFavorite: noteData.isFavorite,
      extraNotes: noteData.extraNotes,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
    };
  }
}