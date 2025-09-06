import type { Tag } from '@domain/entities/Tag'
import type { ITagRepository } from '@domain/repositories/ITagRepository'

import {
  chapters,
  chapterTags,
  characterTags,
  db,
  locations,
  locationTags,
  scenes,
  sceneTags,
  tags,
} from '@keres/db'
import { and, eq } from 'drizzle-orm'

export class TagRepository implements ITagRepository {
  constructor() {}

  async findById(tagId: string): Promise<Tag | null> {
    try {
      const result = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in TagRepository.findById:', error)
      throw error
    }
  }

  async addTagToCharacter(characterId: string, tagId: string): Promise<void> {
    try {
      await db.insert(characterTags).values({ characterId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToCharacter:', error)
      throw error
    }
  }

  async removeTagFromCharacter(characterId: string, tagId: string): Promise<void> {
    try {
      await db
        .delete(characterTags)
        .where(and(eq(characterTags.characterId, characterId), eq(characterTags.tagId, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromCharacter:', error)
      throw error
    }
  }

  async addTagToLocation(locationId: string, tagId: string): Promise<void> {
    try {
      await db.insert(locationTags).values({ locationId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToLocation:', error)
      throw error
    }
  }

  async removeTagFromLocation(locationId: string, tagId: string): Promise<void> {
    try {
      await db.delete(locationTags).where(and(eq(locations.id, locationId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromLocation:', error)
      throw error
    }
  }

  async addTagToChapter(chapterId: string, tagId: string): Promise<void> {
    try {
      await db.insert(chapterTags).values({ chapterId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToChapter:', error)
      throw error
    }
  }

  async removeTagFromChapter(chapterId: string, tagId: string): Promise<void> {
    try {
      await db.delete(chapterTags).where(and(eq(chapters.id, chapterId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromChapter:', error)
      throw error
    }
  }

  async addTagToScene(sceneId: string, tagId: string): Promise<void> {
    try {
      await db.insert(sceneTags).values({ sceneId, tagId })
    } catch (error) {
      console.error('Error in TagRepository.addTagToScene:', error)
      throw error
    }
  }

  async removeTagFromScene(sceneId: string, tagId: string): Promise<void> {
    try {
      await db.delete(sceneTags).where(and(eq(scenes.id, sceneId), eq(tags.id, tagId)))
    } catch (error) {
      console.error('Error in TagRepository.removeTagFromScene:', error)
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
}
