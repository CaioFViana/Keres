import type { Suggestion } from '@domain/entities/Suggestion'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse, UpdateManySuggestionsPayload } from '@keres/shared'

export class UpdateManySuggestionsUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: UpdateManySuggestionsPayload): Promise<SuggestionResponse[]> {
    if (data.length === 0) {
      return []
    }

    const updatedSuggestions: Suggestion[] = []
    const suggestionResponses: SuggestionResponse[] = []

    for (const suggestionPayload of data) {
      if (!suggestionPayload.id) {
        throw new Error('Suggestion ID is required for batch update')
      }

      const existingSuggestion = await this.suggestionRepository.findById(suggestionPayload.id)
      if (!existingSuggestion) {
        throw new Error(`Suggestion with ID ${suggestionPayload.id} not found`)
      }

      // Validate scope and storyId consistency
      if (suggestionPayload.scope === 'story') {
        if (!suggestionPayload.storyId) {
          throw new Error('storyId is required for story-scoped suggestions')
        }
        const story = await this.storyRepository.findById(suggestionPayload.storyId, userId)
        if (!story) {
          throw new Error('Story not found or not owned by user')
        }
      } else if (suggestionPayload.scope === 'global') {
        if (suggestionPayload.storyId) {
          throw new Error('storyId should not be provided for global-scoped suggestions')
        }
      }

      const suggestionToUpdate: Suggestion = {
        ...existingSuggestion,
        ...suggestionPayload,
        updatedAt: new Date(),
      }
      updatedSuggestions.push(suggestionToUpdate)
      suggestionResponses.push({
        id: suggestionToUpdate.id,
        userId: suggestionToUpdate.userId,
        scope: suggestionToUpdate.scope,
        storyId: suggestionToUpdate.storyId,
        type: suggestionToUpdate.type,
        value: suggestionToUpdate.value,
        isDefault: suggestionToUpdate.isDefault,
        createdAt: suggestionToUpdate.createdAt,
        updatedAt: suggestionToUpdate.updatedAt,
      })
    }

    await this.suggestionRepository.updateMany(updatedSuggestions)

    return suggestionResponses
  }
}
