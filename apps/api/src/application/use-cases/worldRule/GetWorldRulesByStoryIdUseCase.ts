import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { WorldRuleResponse } from '@keres/shared'

export class GetWorldRulesByStoryIdUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, storyId: string): Promise<WorldRuleResponse[]> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const worldRules = await this.worldRuleRepository.findByStoryId(storyId)
    return worldRules.map((worldRule) => ({
      id: worldRule.id,
      storyId: worldRule.storyId,
      title: worldRule.title,
      description: worldRule.description,
      isFavorite: worldRule.isFavorite,
      extraNotes: worldRule.extraNotes,
      createdAt: worldRule.createdAt,
      updatedAt: worldRule.updatedAt,
    }))
  }
}
