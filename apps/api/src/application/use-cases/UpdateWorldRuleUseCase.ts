import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository';
import type { WorldRuleResponse, UpdateWorldRulePayload } from '@keres/shared';

export class UpdateWorldRuleUseCase {
  constructor(private readonly worldRuleRepository: IWorldRuleRepository) {}

  async execute(data: UpdateWorldRulePayload): Promise<WorldRuleResponse | null> {
    const existingWorldRule = await this.worldRuleRepository.findById(data.id);
    if (!existingWorldRule) {
      return null; // WorldRule not found
    }

    const updatedWorldRule = {
      ...existingWorldRule,
      ...data,
      updatedAt: new Date(),
    };

    await this.worldRuleRepository.update(updatedWorldRule);

    return {
      id: updatedWorldRule.id,
      storyId: updatedWorldRule.storyId,
      title: updatedWorldRule.title,
      description: updatedWorldRule.description,
      isFavorite: updatedWorldRule.isFavorite,
      extraNotes: updatedWorldRule.extraNotes,
      createdAt: updatedWorldRule.createdAt,
      updatedAt: updatedWorldRule.updatedAt,
    };
  }
}