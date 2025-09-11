import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterRelationResponse, CreateManyCharacterRelationsPayload } from 'schemas'

import { ulid } from 'ulid'

export class CreateManyCharacterRelationsUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    data: CreateManyCharacterRelationsPayload,
  ): Promise<CharacterRelationResponse[]> {
    if (data.length === 0) {
      return []
    }

    const newCharacterRelations: CharacterRelation[] = []
    const characterRelationResponses: CharacterRelationResponse[] = []

    for (const payload of data) {
      // Validate character existence and ownership
      const char1 = await this.characterRepository.findById(payload.charId1)
      if (!char1) {
        throw new Error(`Character with ID ${payload.charId1} not found`)
      }
      const char2 = await this.characterRepository.findById(payload.charId2)
      if (!char2) {
        throw new Error(`Character with ID ${payload.charId2} not found`)
      }

      // Ensure both characters belong to the same story and the user owns that story
      if (char1.storyId !== char2.storyId) {
        throw new Error('Characters must belong to the same story')
      }
      const story = await this.storyRepository.findById(char1.storyId, userId)
      if (!story) {
        throw new Error('Story not found or not owned by user')
      }

      const newCharacterRelation: CharacterRelation = {
        id: ulid(),
        charId1: payload.charId1,
        charId2: payload.charId2,
        relationType: payload.relationType,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      newCharacterRelations.push(newCharacterRelation)
      characterRelationResponses.push({
        id: newCharacterRelation.id,
        charId1: newCharacterRelation.charId1,
        charId2: newCharacterRelation.charId2,
        relationType: newCharacterRelation.relationType,
        createdAt: newCharacterRelation.createdAt,
        updatedAt: newCharacterRelation.updatedAt,
      })
    }

    await this.characterRelationRepository.saveMany(newCharacterRelations)

    return characterRelationResponses
  }
}
