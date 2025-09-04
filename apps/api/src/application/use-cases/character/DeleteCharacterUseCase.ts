import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteCharacterUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingCharacter = await this.characterRepository.findById(id)
    if (!existingCharacter) {
      throw new Error('Character not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingCharacter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }
    await this.characterRepository.delete(id, existingCharacter.storyId)
    return true
  }
}
