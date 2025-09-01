import type { Tag } from '@domain/entities/Tag'
import type { ITagRepository } from '@domain/repositories/ITagRepository'

import { db, tags } from '@keres/db' // Import db and tags table
import { eq } from 'drizzle-orm'

export class TagRepository implements ITagRepository {
  constructor() {
    console.log('TagRepository constructor called.')
  }

  async findById(id: string): Promise<Tag | null> {
    console.log('TagRepository.findById called.')
    try {
      const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in TagRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Tag[]> {
    console.log('TagRepository.findByStoryId called.')
    try {
      const results = await db.select().from(tags).where(eq(tags.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in TagRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(tagData: Tag): Promise<void> {
    console.log('TagRepository.save called.')
    try {
      await db.insert(tags).values(this.toPersistence(tagData))
    } catch (error) {
      console.error('Error in TagRepository.save:', error)
      throw error
    }
  }

  async update(tagData: Tag): Promise<void> {
    console.log('TagRepository.update called.')
    try {
      await db.update(tags).set(this.toPersistence(tagData)).where(eq(tags.id, tagData.id))
    } catch (error) {
      console.error('Error in TagRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    console.log('TagRepository.delete called.')
    try {
      await db.delete(tags).where(eq(tags.id, id))
    } catch (error) {
      console.error('Error in TagRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof tags.$inferSelect): Tag {
    console.log('TagRepository.toDomain called.')
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
    console.log('TagRepository.toPersistence called.')
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
