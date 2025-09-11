import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { WorldRuleResponse } from 'schemas'

export class GetWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<WorldRuleResponse> {
    const worldRule = await this.worldRuleRepository.findById(id)
    if (!worldRule) {
      throw new Error('World Rule not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(worldRule.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: worldRule.id,
      storyId: worldRule.storyId,
      title: worldRule.title,
      description: worldRule.description,
      isFavorite: worldRule.isFavorite,
      extraNotes: worldRule.extraNotes,
      createdAt: worldRule.createdAt,
      updatedAt: worldRule.updatedAt,
    }
  }
}
