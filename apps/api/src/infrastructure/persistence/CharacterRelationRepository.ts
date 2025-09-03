import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'

import { characterRelations, db } from '@keres/db' // Import db and characterRelations table
import { eq, or } from 'drizzle-orm'

export class CharacterRelationRepository implements ICharacterRelationRepository {
  constructor() {
    
  }

  async findById(id: string): Promise<CharacterRelation | null> {
    
    try {
      const result = await db
        .select()
        .from(characterRelations)
        .where(eq(characterRelations.id, id))
        .limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in CharacterRelationRepository.findById:', error)
      throw error
    }
  }

  async findByCharId(charId: string): Promise<CharacterRelation[]> {
    
    try {
      const results = await db
        .select()
        .from(characterRelations)
        .where(or(eq(characterRelations.charId1, charId), eq(characterRelations.charId2, charId)))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in CharacterRelationRepository.findByCharId:', error)
      throw error
    }
  }

  async save(characterRelationData: CharacterRelation): Promise<void> {
    
    try {
      await db.insert(characterRelations).values(this.toPersistence(characterRelationData))
    } catch (error) {
      console.error('Error in CharacterRelationRepository.save:', error)
      throw error
    }
  }

  async update(characterRelationData: CharacterRelation): Promise<void> {
    
    try {
      await db
        .update(characterRelations)
        .set(this.toPersistence(characterRelationData))
        .where(eq(characterRelations.id, characterRelationData.id))
    } catch (error) {
      console.error('Error in CharacterRelationRepository.update:', error)
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    
    try {
      await db.delete(characterRelations).where(eq(characterRelations.id, id))
    } catch (error) {
      console.error('Error in CharacterRelationRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof characterRelations.$inferSelect): CharacterRelation {
    
    return {
      id: data.id,
      charId1: data.charId1,
      charId2: data.charId2,
      relationType: data.relationType,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(
    characterRelationData: CharacterRelation,
  ): typeof characterRelations.$inferInsert {
    
    return {
      id: characterRelationData.id,
      charId1: characterRelationData.charId1,
      charId2: characterRelationData.charId2,
      relationType: characterRelationData.relationType,
      createdAt: characterRelationData.createdAt,
      updatedAt: characterRelationData.updatedAt,
    }
  }
}
