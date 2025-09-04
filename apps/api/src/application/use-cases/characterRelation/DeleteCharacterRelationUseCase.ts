import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import

export class DeleteCharacterRelationUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(id)
    if (!existingCharacterRelation) {
      throw new Error('Character relation not found')
    }

    // Verify character1 ownership
    const character1 = await this.characterRepository.findById(existingCharacterRelation.charId1)
    if (!character1) {
      throw new Error('Character 1 not found for relation')
    }
    const story = await this.storyRepository.findById(character1.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for character relation')
    }

    await this.characterRelationRepository.delete(id)
    return true
  }
}
