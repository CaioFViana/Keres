import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { UpdateWorldRulePayload, WorldRuleResponse } from '@keres/shared'

export class UpdateWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: UpdateWorldRulePayload): Promise<WorldRuleResponse> {
    const existingWorldRule = await this.worldRuleRepository.findById(data.id)
    if (!existingWorldRule) {
      throw new Error('World Rule not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingWorldRule.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedWorldRule = {
      ...existingWorldRule,
      ...data,
      updatedAt: new Date(),
    }

    await this.worldRuleRepository.update(updatedWorldRule, existingWorldRule.storyId)

    return {
      id: updatedWorldRule.id,
      storyId: updatedWorldRule.storyId,
      title: updatedWorldRule.title,
      description: updatedWorldRule.description,
      isFavorite: updatedWorldRule.isFavorite,
      extraNotes: updatedWorldRule.extraNotes,
      createdAt: updatedWorldRule.createdAt,
      updatedAt: updatedWorldRule.updatedAt,
    }
  }
}
