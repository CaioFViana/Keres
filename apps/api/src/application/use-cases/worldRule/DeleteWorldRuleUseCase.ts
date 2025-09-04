import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingWorldRule = await this.worldRuleRepository.findById(id)
    if (!existingWorldRule) {
      throw new Error('World Rule not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingWorldRule.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.worldRuleRepository.delete(id, existingWorldRule.storyId)
    return true
  }
}
