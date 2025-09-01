import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse } from '@keres/shared'

export class GetSuggestionsByStoryIdUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(storyId: string): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByStoryId(storyId)
    return suggestions.map((suggestion) => ({
      id: suggestion.id,
      userId: suggestion.userId,
      scope: suggestion.scope,
      storyId: suggestion.storyId,
      type: suggestion.type,
      value: suggestion.value,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    }))
  }
}
