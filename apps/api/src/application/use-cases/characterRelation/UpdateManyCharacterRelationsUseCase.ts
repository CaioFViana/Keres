import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterRelationResponse, UpdateManyCharacterRelationsPayload } from '@keres/shared'

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
      const char1 = await this.characterRepository.findById(
        payload.charId1 || existingCharacterRelation.charId1,
      )
      if (!char1) {
        throw new Error(
          `Character with ID ${payload.charId1 || existingCharacterRelation.charId1} not found`,
        )
      }
      const char2 = await this.characterRepository.findById(
        payload.charId2 || existingCharacterRelation.charId2,
      )
      if (!char2) {
        throw new Error(
          `Character with ID ${payload.charId2 || existingCharacterRelation.charId2} not found`,
        )
      }

      // Ensure both characters belong to the same story and the user owns that story
      if (char1.storyId !== char2.storyId) {
        throw new Error('Characters must belong to the same story')
      }
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
