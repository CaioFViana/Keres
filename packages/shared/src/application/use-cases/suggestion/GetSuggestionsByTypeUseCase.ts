import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ListQueryParams, SuggestionResponse, PaginatedResponse } from 'schemas'

export class GetSuggestionsByTypeUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(
    userId: string,
    type: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<SuggestionResponse>> {
    // In this use case, we want to get global suggestions of a specific type
    // that are owned by the user. So, storyId is null.
    const paginatedSuggestions = await this.suggestionRepository.findByType(type, userId, null, query)

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
