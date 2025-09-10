import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ListQueryParams, SuggestionResponse, PaginatedResponse } from '@keres/shared'

export class GetSuggestionsByUserIdUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(userId: string, query: ListQueryParams): Promise<PaginatedResponse<SuggestionResponse>> {
    const paginatedSuggestions = await this.suggestionRepository.findByUserId(userId, query)

    const items = paginatedSuggestions.items.map((suggestion) => ({
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

    return {
      items,
      totalItems: paginatedSuggestions.totalItems,
    }
  }
}
