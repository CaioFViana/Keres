import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'

import { characterRelations, db } from '@infrastructure/db' // Import db, characterRelations
import { and, eq, or } from 'drizzle-orm' // Import and
import { ulid } from 'ulid'

export class CharacterRelationRepository implements ICharacterRelationRepository {
  private getCanonicalCharIds(charId1: string, charId2: string): [string, string] {
    return charId1 < charId2 ? [charId1, charId2] : [charId2, charId1]
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
      const [canonicalCharId1, canonicalCharId2] = this.getCanonicalCharIds(
        characterRelationData.charId1,
        characterRelationData.charId2,
      )

      // Check for existing relation with canonical IDs and same relationType
      const existingRelation = await db
        .select()
        .from(characterRelations)
        .where(
          and(
            eq(characterRelations.charId1, canonicalCharId1),
            eq(characterRelations.charId2, canonicalCharId2),
            eq(characterRelations.relationType, characterRelationData.relationType),
          ),
        )
        .limit(1)

      if (existingRelation.length > 0) {
        throw new Error('Relation already exists between these characters with this type.')
      }

      await db.insert(characterRelations).values({
        id: ulid(),
        charId1: canonicalCharId1,
        charId2: canonicalCharId2,
        relationType: characterRelationData.relationType,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (error) {
      console.error('Error in CharacterRelationRepository.save:', error)
      throw error
    }
  }

  async saveMany(characterRelationsData: CharacterRelation[]): Promise<void> {
    try {
      if (characterRelationsData.length === 0) {
        return
      }
      await db.transaction(async (tx: any) => {
        for (const relationData of characterRelationsData) {
          const [canonicalCharId1, canonicalCharId2] = this.getCanonicalCharIds(
            relationData.charId1,
            relationData.charId2,
          )

          // Check for existing relation with canonical IDs and same relationType
          const existingRelation = await tx
            .select()
            .from(characterRelations)
            .where(
              and(
                eq(characterRelations.charId1, canonicalCharId1),
                eq(characterRelations.charId2, canonicalCharId2),
                eq(characterRelations.relationType, relationData.relationType),
              ),
            )
            .limit(1)

          if (existingRelation.length > 0) {
            throw new Error(
              `Relation already exists between ${relationData.charId1} and ${relationData.charId2} with type ${relationData.relationType}.`,
            )
          }

          await tx.insert(characterRelations).values({
            id: ulid(),
            charId1: canonicalCharId1,
            charId2: canonicalCharId2,
            relationType: relationData.relationType,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      })
    } catch (error) {
      console.error('Error in CharacterRelationRepository.saveMany:', error)
      throw error
    }
  }

  async update(characterRelationData: CharacterRelation): Promise<void> {
    try {
      // For simplicity, only relationType can be updated. charId1 and charId2 are immutable.
      await db
        .update(characterRelations)
        .set({
          relationType: characterRelationData.relationType,
          updatedAt: new Date(),
        })
        .where(eq(characterRelations.id, characterRelationData.id))
    } catch (error) {
      console.error('Error in CharacterRelationRepository.update:', error)
      throw error
    }
  }

  async updateMany(characterRelationsData: CharacterRelation[]): Promise<void> {
    try {
      if (characterRelationsData.length === 0) {
        return
      }
      await db.transaction(async (tx: any) => {
        for (const relationData of characterRelationsData) {
          await tx
            .update(characterRelations)
            .set({
              relationType: relationData.relationType,
              updatedAt: new Date(),
            })
            .where(eq(characterRelations.id, relationData.id))
        }
      })
    } catch (error) {
      console.error('Error in CharacterRelationRepository.updateMany:', error)
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

  async deleteByCharacterId(characterId: string): Promise<void> {
    try {
      await db
        .delete(characterRelations)
        .where(
          or(
            eq(characterRelations.charId1, characterId),
            eq(characterRelations.charId2, characterId),
          ),
        );
    } catch (error) {
      console.error('Error in CharacterRelationRepository.deleteByCharacterId:', error);
      throw error;
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
}
