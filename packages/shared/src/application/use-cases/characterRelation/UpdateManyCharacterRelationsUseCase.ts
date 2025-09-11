import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterRelationResponse, UpdateManyCharacterRelationsPayload } from 'schemas'

export class UpdateManyCharacterRelationsUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    data: UpdateManyCharacterRelationsPayload,
  ): Promise<CharacterRelationResponse[]> {
    if (data.length === 0) {
      return []
    }

    const updatedCharacterRelations: CharacterRelation[] = []
    const characterRelationResponses: CharacterRelationResponse[] = []

    for (const payload of data) {
      if (!payload.id) {
        throw new Error('Character Relation ID is required for batch update')
      }

      const existingCharacterRelation = await this.characterRelationRepository.findById(payload.id)
      if (!existingCharacterRelation) {
        throw new Error(`Character Relation with ID ${payload.id} not found`)
      }

      // Validate character existence and ownership
      const char1 = await this.characterRepository.findById(existingCharacterRelation.charId1)
      if (!char1) {
        throw new Error(
          `Character with ID ${existingCharacterRelation.charId1} not found`,
        )
      }

      // Ensure user owns that story
      const story = await this.storyRepository.findById(char1.storyId, userId)
      if (!story) {
        throw new Error('Story not found or not owned by user')
      }

      const characterRelationToUpdate: CharacterRelation = {
        ...existingCharacterRelation,
        ...payload,
        updatedAt: new Date(),
      }
      updatedCharacterRelations.push(characterRelationToUpdate)
      characterRelationResponses.push({
        id: characterRelationToUpdate.id,
        charId1: characterRelationToUpdate.charId1,
        charId2: characterRelationToUpdate.charId2,
        relationType: characterRelationToUpdate.relationType,
        createdAt: characterRelationToUpdate.createdAt,
        updatedAt: characterRelationToUpdate.updatedAt,
      })
    }

    await this.characterRelationRepository.updateMany(updatedCharacterRelations)

    return characterRelationResponses
  }
}
