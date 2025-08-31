import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository';
import type { SuggestionResponse } from '@keres/shared';

export class GetSuggestionsByUserIdUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(userId: string): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByUserId(userId);
    return suggestions.map((suggestion) => ({
      id: suggestion.id,
      userId: suggestion.userId,
      scope: suggestion.scope,
      storyId: suggestion.storyId,
      type: suggestion.type,
      value: suggestion.value,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    }));
  }
}