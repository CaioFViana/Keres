import type { CharacterRelation } from '@domain/entities/CharacterRelation'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterRelationCreatePayload, CharacterRelationResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateCharacterRelationUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(
    userId: string,
    data: CharacterRelationCreatePayload,
  ): Promise<CharacterRelationResponse> {
    // Verify character1 ownership
    const character1 = await this.characterRepository.findById(data.charId1)
    if (!character1) {
      throw new Error('Character 1 not found')
    }

    // Verify character2 ownership
    const character2 = await this.characterRepository.findById(data.charId2)
    if (!character2) {
      throw new Error('Character 2 not found')
    }

    // Verify that both characters belong to the same story
    if (character1.storyId !== character2.storyId) {
      throw new Error('Characters do not belong to the same story')
    }

    // Verify that the story belongs to the user
    const story = await this.storyRepository.findById(character1.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newCharacterRelation: CharacterRelation = {
      id: ulid(),
      charId1: data.charId1,
      charId2: data.charId2,
      relationType: data.relationType,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.characterRelationRepository.save(newCharacterRelation)

    return {
      id: newCharacterRelation.id,
      charId1: newCharacterRelation.charId1,
      charId2: newCharacterRelation.charId2,
      relationType: newCharacterRelation.relationType,
      createdAt: newCharacterRelation.createdAt,
      updatedAt: newCharacterRelation.updatedAt,
    }
  }
}
