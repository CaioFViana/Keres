import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository';
import type { WorldRuleResponse } from '@keres/shared';

export class GetWorldRulesByStoryIdUseCase {
  constructor(private readonly worldRuleRepository: IWorldRuleRepository) {}

  async execute(storyId: string): Promise<WorldRuleResponse[]> {
    const worldRules = await this.worldRuleRepository.findByStoryId(storyId);
    return worldRules.map((worldRule) => ({
      id: worldRule.id,
      storyId: worldRule.storyId,
      title: worldRule.title,
      description: worldRule.description,
      isFavorite: worldRule.isFavorite,
      extraNotes: worldRule.extraNotes,
      createdAt: worldRule.createdAt,
      updatedAt: worldRule.updatedAt,
    }));
  }
}