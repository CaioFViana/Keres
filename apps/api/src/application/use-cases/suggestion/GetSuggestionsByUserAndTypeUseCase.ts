import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ListQueryParams, SuggestionResponse } from '@keres/shared'

export class GetSuggestionsByUserAndTypeUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(userId: string, type: string, query: ListQueryParams): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByUserAndType(userId, type, query)
    // Ensure that all returned suggestions actually belong to the requested userId
    const filteredSuggestions = suggestions.filter((suggestion) => suggestion.userId === userId)

    return filteredSuggestions.map((suggestion) => ({
      id: suggestion.id,
      userId: suggestion.userId,
      scope: suggestion.scope,
      storyId: suggestion.storyId,
      type: suggestion.type,
      value: suggestion.value,
      isDefault: suggestion.isDefault,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
    }))
  }
}
