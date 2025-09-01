import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse } from '@keres/shared'

export class GetSuggestionUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(id: string): Promise<SuggestionResponse | null> {
    const suggestion = await this.suggestionRepository.findById(id)
    if (!suggestion) {
      return null
    }

    return {
      id: suggestion.id,
      userId: suggestion.userId,
      scope: suggestion.scope,
      storyId: suggestion.storyId,
      type: suggestion.type,
      value: suggestion.value,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    }
  }
}
