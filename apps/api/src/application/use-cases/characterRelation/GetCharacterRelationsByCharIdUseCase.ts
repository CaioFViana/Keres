import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterRelationResponse } from '@keres/shared'

export class GetCharacterRelationsByCharIdUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, charId: string): Promise<CharacterRelationResponse[]> {
    // Verify character ownership
    const character = await this.characterRepository.findById(charId)
    if (!character) {
      throw new Error('Character not found')
    }
    const story = await this.storyRepository.findById(character.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const characterRelations = await this.characterRelationRepository.findByCharId(charId)
    return characterRelations.map((cr) => ({
      id: cr.id,
      charId1: cr.charId1,
      charId2: cr.charId2,
      relationType: cr.relationType,
      createdAt: cr.createdAt,
      updatedAt: cr.updatedAt,
    }))
  }
}
