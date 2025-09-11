import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterMomentResponse } from 'schemas'

export class GetCharacterMomentsByCharacterIdUseCase {
  constructor(
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, characterId: string): Promise<CharacterMomentResponse[]> {
    // Verify character ownership
    const character = await this.characterRepository.findById(characterId)
    if (!character) {
      throw new Error('Character not found')
    }
    const story = await this.storyRepository.findById(character.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const characterMoments = await this.characterMomentRepository.findByCharacterId(characterId)
    return characterMoments.map((cm) => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }))
  }
}
