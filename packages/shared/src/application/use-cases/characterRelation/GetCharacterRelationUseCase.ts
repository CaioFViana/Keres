import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterRelationResponse } from 'schemas'

export class GetCharacterRelationUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, id: string): Promise<CharacterRelationResponse> {
    const characterRelation = await this.characterRelationRepository.findById(id)
    if (!characterRelation) {
      throw new Error('Character relation not found')
    }

    // Verify character1 ownership
    const character1 = await this.characterRepository.findById(characterRelation.charId1)
    if (!character1) {
      throw new Error('Character 1 not found for relation')
    }
    const story = await this.storyRepository.findById(character1.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for character relation')
    }

    return {
      id: characterRelation.id,
      charId1: characterRelation.charId1,
      charId2: characterRelation.charId2,
      relationType: characterRelation.relationType,
      createdAt: characterRelation.createdAt,
      updatedAt: characterRelation.updatedAt,
    }
  }
}
