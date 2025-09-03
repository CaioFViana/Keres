import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'

import { characters, db } from '@keres/db' // Import db and characters table
import { eq } from 'drizzle-orm'

export class CharacterRepository implements ICharacterRepository {
  constructor() {
    
  }

  async findById(id: string): Promise<Character | null> {
    
    try {
      const result = await db.select().from(characters).where(eq(characters.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in CharacterRepository.findById:', error)
      throw error
    }
  }

  async findByStoryId(storyId: string): Promise<Character[]> {
    
    try {
      const results = await db.select().from(characters).where(eq(characters.storyId, storyId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in CharacterRepository.findByStoryId:', error)
      throw error
    }
  }

  async save(characterData: Character): Promise<void> {
    
    try {
      await db.insert(characters).values(this.toPersistence(characterData))
    } catch (error) {
      console.error('Error in CharacterRepository.save:', error)
      throw error
    }
  }

  async update(characterData: Character): Promise<void> {
    
    try {
      await db
        .update(characters)
        .set(this.toPersistence(characterData))
        .where(eq(characters.id, characterData.id))
    } catch (error) {
      console.error('Error in CharacterRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    
    try {
      await db.delete(characters).where(eq(characters.id, id))
    } catch (error) {
      console.error('Error in CharacterRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof characters.$inferSelect): Character {
    
    return {
      id: data.id,
      storyId: data.storyId,
      name: data.name,
      gender: data.gender,
      race: data.race,
      subrace: data.subrace,
      description: data.description,
      personality: data.personality,
      motivation: data.motivation,
      qualities: data.qualities,
      weaknesses: data.weaknesses,
      biography: data.biography,
      plannedTimeline: data.plannedTimeline,
      isFavorite: data.isFavorite,
      extraNotes: data.extraNotes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(characterData: Character): typeof characters.$inferInsert {
    
    return {
      id: characterData.id,
      storyId: characterData.storyId,
      name: characterData.name,
      gender: characterData.gender,
      race: characterData.race,
      subrace: characterData.subrace,
      personality: characterData.personality,
      motivation: characterData.motivation,
      qualities: characterData.qualities,
      weaknesses: characterData.weaknesses,
      biography: characterData.biography,
      plannedTimeline: characterData.plannedTimeline,
      isFavorite: characterData.isFavorite,
      extraNotes: characterData.extraNotes,
      createdAt: characterData.createdAt,
      updatedAt: characterData.updatedAt,
    }
  }
}
