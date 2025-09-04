import type { Tag } from '@domain/entities/Tag'
import type { ITagRepository } from '@domain/repositories/ITagRepository'

import { db, tags } from '@keres/db' // Import db and tags table
import { eq } from 'drizzle-orm'

export class TagRepository implements ITagRepository {
  constructor() {}

  async findById(id: string): Promise<Tag | null> {
    try {
      const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in TagRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Tag[]> {
    try {
      const results = await db.select().from(tags).where(eq(tags.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in TagRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(tagData: Tag): Promise<void> {
    try {
      await db.insert(tags).values(this.toPersistence(tagData))
    } catch (error) {
      console.error('Error in TagRepository.save:', error)
      throw error
    }
  }

  async update(tagData: Tag, storyId: string): Promise<void> {
    try {
      await db
        .update(tags)
        .set(this.toPersistence(tagData))
        .where(eq(tags.id, tagData.id), eq(tags.storyId, storyId))
    } catch (error) {
      console.error('Error in TagRepository.update:', error)
      throw error
    }
  }

  async delete(id: string, storyId: string): Promise<void> {
    try {
      await db.delete(tags).where(eq(tags.id, id), eq(tags.storyId, storyId))
    } catch (error) {
      console.error('Error in TagRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof tags.$inferSelect): Tag {
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      color: data.color,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(tagData: Tag): typeof tags.$inferInsert {
    return {
      id: tagData.id,
      storyId: tagData.storyId,
      name: tagData.name,
      color: tagData.color,
      isFavorite: tagData.isFavorite,
      extraNotes: tagData.extraNotes,
      createdAt: tagData.createdAt,
      updatedAt: tagData.updatedAt,
    }
  }
}