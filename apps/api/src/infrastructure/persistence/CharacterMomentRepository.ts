import type { CharacterMoment } from '@domain/entities/CharacterMoment'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'

import { characterMoments, db } from '@keres/db' // Import db and characterMoments table
import { and, eq } from 'drizzle-orm'

export class CharacterMomentRepository implements ICharacterMomentRepository {
  constructor() {}

  async findByCharacterId(characterId: string): Promise<CharacterMoment[]> {
    try {
      const results = await db
        .select()
        .from(characterMoments)
        .where(eq(characterMoments.characterId, characterId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in CharacterMomentRepository.findByCharacterId:', error)
      throw error
    }
  }

  async findByMomentId(momentId: string): Promise<CharacterMoment[]> {
    try {
      const results = await db
        .select()
        .from(characterMoments)
        .where(eq(characterMoments.momentId, momentId))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in CharacterMomentRepository.findByMomentId:', error)
      throw error
    }
  }

  async save(characterMomentData: CharacterMoment): Promise<void> {
    try {
      await db.insert(characterMoments).values(this.toPersistence(characterMomentData))
    } catch (error) {
      console.error('Error in CharacterMomentRepository.save:', error)
      throw error
    }
  }

  async delete(characterId: string, momentId: string): Promise<void> {
    try {
      await db
        .delete(characterMoments)
        .where(
          and(
            eq(characterMoments.characterId, characterId),
            eq(characterMoments.momentId, momentId),
          ),
        )
    } catch (error) {
      console.error('Error in CharacterMomentRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof characterMoments.$inferSelect): CharacterMoment {
    return {
      characterId: data.characterId,
      momentId: data.momentId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(
    characterMomentData: CharacterMoment,
  ): typeof characterMoments.$inferInsert {
    return {
      characterId: characterMomentData.characterId,
      momentId: characterMomentData.momentId,
      createdAt: characterMomentData.createdAt,
      updatedAt: characterMomentData.updatedAt,
    }
  }
}
