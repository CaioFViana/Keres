import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { WorldRuleResponse } from '@keres/shared'

export class GetWorldRuleUseCase {
  constructor(private readonly worldRuleRepository: IWorldRuleRepository) {}

  async execute(id: string): Promise<WorldRuleResponse | null> {
    const worldRule = await this.worldRuleRepository.findById(id)
    if (!worldRule) {
      return null
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
