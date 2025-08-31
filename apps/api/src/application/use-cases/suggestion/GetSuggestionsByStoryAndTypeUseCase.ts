import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository';
import type { SuggestionResponse } from '@keres/shared';

export class GetSuggestionsByStoryAndTypeUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(storyId: string, type: string): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByStoryAndType(storyId, type);
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