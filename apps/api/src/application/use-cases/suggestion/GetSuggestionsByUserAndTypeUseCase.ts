import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse } from '@keres/shared'

export class GetSuggestionsByUserAndTypeUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(userId: string, type: string): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByUserAndType(userId, type)
    // Ensure that all returned suggestions actually belong to the requested userId
    const filteredSuggestions = suggestions.filter((suggestion) => suggestion.userId === userId)

    return filteredSuggestions.map((suggestion) => ({
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
