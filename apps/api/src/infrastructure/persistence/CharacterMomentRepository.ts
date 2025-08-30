import type { CharacterMoment } from '@domain/entities/CharacterMoment'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'

import { characterMoments, db } from '@keres/db' // Import db and characterMoments table
import { and, eq } from 'drizzle-orm'

export class CharacterMomentRepository implements ICharacterMomentRepository {
  constructor() {
    console.log('CharacterMomentRepository constructor called.')
  }

  async findByCharacterId(characterId: string): Promise<CharacterMoment[]> {
    console.log('CharacterMomentRepository.findByCharacterId called.')
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
    console.log('CharacterMomentRepository.findByMomentId called.')
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
    console.log('CharacterMomentRepository.save called.')
    try {
      await db.insert(characterMoments).values(this.toPersistence(characterMomentData))
    } catch (error) {
      console.error('Error in CharacterMomentRepository.save:', error)
      throw error
    }
  }

  async delete(characterId: string, momentId: string): Promise<void> {
    console.log('CharacterMomentRepository.delete called.')
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
    console.log('CharacterMomentRepository.toDomain called.')
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
    console.log('CharacterMomentRepository.toPersistence called.')
    return {
      characterId: characterMomentData.characterId,
      momentId: characterMomentData.momentId,
      createdAt: characterMomentData.createdAt,
      updatedAt: characterMomentData.updatedAt,
    }
  }
}
