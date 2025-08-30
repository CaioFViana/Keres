import { eq } from 'drizzle-orm';
import { db, chapters } from '@keres/db'; // Import db and chapters table
import { Chapter } from '@domain/entities/Chapter';
import { IChapterRepository } from '@domain/repositories/IChapterRepository';

export class ChapterRepository implements IChapterRepository {
  constructor() {
    console.log('ChapterRepository constructor called.');
  }

  async findById(id: string): Promise<Chapter | null> {
    console.log('ChapterRepository.findById called.');
    try {
      const result = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
      return result.length > 0 ? this.toDomain(result[0]) : null;
    } catch (error) {
      console.error('Error in ChapterRepository.findById:', error);
      throw error;
    }
  }

  async findByStoryId(storyId: string): Promise<Chapter[]> {
    console.log('ChapterRepository.findByStoryId called.');
    try {
      const results = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
      return results.map(this.toDomain);
    } catch (error) {
      console.error('Error in ChapterRepository.findByStoryId:', error);
      throw error;
    }
  }

  async save(chapterData: Chapter): Promise<void> {
    console.log('ChapterRepository.save called.');
    try {
      await db.insert(chapters).values(this.toPersistence(chapterData));
    } catch (error) {
      console.error('Error in ChapterRepository.save:', error);
      throw error;
    }
  }

  async update(chapterData: Chapter): Promise<void> {
    console.log('ChapterRepository.update called.');
    try {
      await db.update(chapters).set(this.toPersistence(chapterData)).where(eq(chapters.id, chapterData.id));
    } catch (error) {
      console.error('Error in ChapterRepository.update:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    console.log('ChapterRepository.delete called.');
    try {
      await db.delete(chapters).where(eq(chapters.id, id));
    } catch (error) {
      console.error('Error in ChapterRepository.delete:', error);
      throw error;
    }
  }

  private toDomain(data: typeof chapters.$inferSelect): Chapter {
    console.log('ChapterRepository.toDomain called.');
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      index: data.index,
      summary: data.summary,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private toPersistence(chapterData: Chapter): typeof chapters.$inferInsert {
    console.log('ChapterRepository.toPersistence called.');
    return {
      id: chapterData.id,
      storyId: chapterData.storyId,
      name: chapterData.name,
      index: chapterData.index,
      summary: chapterData.summary,
      isFavorite: chapterData.isFavorite,
      extraNotes: chapterData.extraNotes,
      createdAt: chapterData.createdAt,
      updatedAt: chapterData.updatedAt,
    };
  }
}