import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { db, story } from '@keres/db' // Import db and stories table
import { eq } from 'drizzle-orm'

export class StoryRepository implements IStoryRepository {
  constructor() {
    
  }

  async findById(id: string): Promise<Story | null> {
    
    try {
      const result = await db.select().from(story).where(eq(story.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in StoryRepository.findById:', error)
      throw error
    }
  }

  async findByUserId(userId: string): Promise<Story[]> {
    
    try {
      const results = await db.select().from(story).where(eq(story.userId, userId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in StoryRepository.findByUserId:', error)
      throw error
    }
  }

  async save(storyData: Story): Promise<void> {
    
    try {
      await db.insert(story).values(this.toPersistence(storyData))
    } catch (error) {
      console.error('Error in StoryRepository.save:', error)
      throw error
    }
  }

  async update(storyData: Story): Promise<void> {
    
    try {
      await db.update(story).set(this.toPersistence(storyData)).where(eq(story.id, storyData.id))
    } catch (error) {
      console.error('Error in StoryRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    
    try {
      await db.delete(story).where(eq(story.id, id))
    } catch (error) {
      console.error('Error in StoryRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof story.$inferSelect): Story {
    
    return {
      id: data.id,
      userId: data.userId,
      title: data.title,
      type: data.type == 'linear' ? data.type : 'branching',
      summary: data.summary,
      genre: data.genre,
      language: data.language,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(storyData: Story): typeof story.$inferInsert {
    
    return {
      id: storyData.id,
      userId: storyData.userId,
      title: storyData.title,
      summary: storyData.summary,
      genre: storyData.genre,
      language: storyData.language,
      isFavorite: storyData.isFavorite,
      extraNotes: storyData.extraNotes,
      createdAt: storyData.createdAt,
      updatedAt: storyData.updatedAt,
    }
  }
}
