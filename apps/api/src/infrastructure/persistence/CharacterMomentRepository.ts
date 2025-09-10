import type { CharacterMoment } from '@domain/entities/CharacterMoment'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'

import { characterMoments, db } from '@infrastructure/db' // Import db and characterMoments table
import { and, eq } from 'drizzle-orm'

export class CharacterMomentRepository implements ICharacterMomentRepository {
  async findById(characterId: string, momentId: string): Promise<CharacterMoment | null> {
    try {
      const result = await db
        .select()
        .from(characterMoments)
        .where(
          and(
            eq(characterMoments.characterId, characterId),
            eq(characterMoments.momentId, momentId),
          ),
        )
        .limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in CharacterMomentRepository.findById:', error)
      throw error
    }
  }

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

  async saveMany(characterMomentsData: CharacterMoment[]): Promise<void> {
    try {
      if (characterMomentsData.length === 0) {
        return
      }
      const persistenceData = characterMomentsData.map(this.toPersistence)
      await db.insert(characterMoments).values(persistenceData)
    } catch (error) {
      console.error('Error in CharacterMomentRepository.saveMany:', error)
      throw error
    }
  }

  async updateMany(characterMomentsData: CharacterMoment[]): Promise<void> {
    try {
      if (characterMomentsData.length === 0) {
        return
      }
      await db.transaction(async (tx: any) => {
        for (const characterMomentData of characterMomentsData) {
          await tx
            .update(characterMoments)
            .set(this.toPersistence(characterMomentData))
            .where(
              and(
                eq(characterMoments.characterId, characterMomentData.characterId),
                eq(characterMoments.momentId, characterMomentData.momentId),
              ),
            )
        }
      })
    } catch (error) {
      console.error('Error in CharacterMomentRepository.updateMany:', error)
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

  async deleteByCharacterId(characterId: string): Promise<void> {
    try {
      await db.delete(characterMoments).where(eq(characterMoments.characterId, characterId));
    } catch (error) {
      console.error('Error in CharacterMomentRepository.deleteByCharacterId:', error);
      throw error;
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
