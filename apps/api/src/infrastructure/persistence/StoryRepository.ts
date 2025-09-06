import type { Story } from '@domain/entities/Story'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ListQueryParams } from '@keres/shared'

import { db, story } from '@keres/db' // Import db and stories table
import { and, eq } from 'drizzle-orm'

export class StoryRepository implements IStoryRepository {
  constructor() {}

  async findById(id: string, userId: string): Promise<Story | null> {
    try {
      const result = await db
        .select()
        .from(story)
        .where(eq(story.id, id), eq(story.userId, userId))
        .limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in StoryRepository.findById:', error)
      throw error
    }
  }

  async findByUserId(userId: string, query?: ListQueryParams): Promise<Story[]> {
    try {
      let queryBuilder = db.select().from(story).where(eq(story.userId, userId))

      if (query?.isFavorite !== undefined) {
        queryBuilder = queryBuilder.where(
          and(eq(story.userId, userId), eq(story.isFavorite, query.isFavorite)),
        )
      }

      const results = await queryBuilder
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

  async update(storyData: Story, userId: string): Promise<void> {
    try {
      await db
        .update(story)
        .set(this.toPersistence(storyData))
        .where(eq(story.id, storyData.id), eq(story.userId, userId))
    } catch (error) {
      console.error('Error in StoryRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    try {
      await db.delete(story).where(eq(story.id, id), eq(story.userId, userId))
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
