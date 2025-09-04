import type { Chapter } from '@domain/entities/Chapter'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'

import { chapters, db } from '@keres/db' // Import db and chapters table
import { eq } from 'drizzle-orm'

export class ChapterRepository implements IChapterRepository {
  constructor() {}

  async findById(id: string): Promise<Chapter | null> {
    try {
      const result = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in ChapterRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Chapter[]> {
    try {
      const results = await db.select().from(chapters).where(eq(chapters.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in ChapterRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(chapterData: Chapter): Promise<void> {
    try {
      await db.insert(chapters).values(this.toPersistence(chapterData))
    } catch (error) {
      console.error('Error in ChapterRepository.save:', error)
      throw error
    }
  }

  async update(chapterData: Chapter, storyId: string): Promise<void> {
    try {
      await db
        .update(chapters)
        .set(this.toPersistence(chapterData))
        .where(eq(chapters.id, chapterData.id), eq(chapters.storyId, storyId))
    } catch (error) {
      console.error('Error in ChapterRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(chapters).where(eq(chapters.id, id), eq(chapters.storyId, storyId))
    } catch (error) {
      console.error('Error in ChapterRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof chapters.$inferSelect): Chapter {
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
    }
  }

  private toPersistence(chapterData: Chapter): typeof chapters.$inferInsert {
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
    }
  }
}
