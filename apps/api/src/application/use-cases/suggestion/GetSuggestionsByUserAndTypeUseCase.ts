import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ListQueryParams, SuggestionResponse, PaginatedResponse } from '@keres/shared'

export class GetSuggestionsByUserAndTypeUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(
    userId: string,
    type: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<SuggestionResponse>> {
    const paginatedSuggestions = await this.suggestionRepository.findByUserAndType(userId, type, query)

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
