import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse } from '@keres/shared'

export class GetSuggestionsByTypeUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, type: string): Promise<SuggestionResponse[]> {
    const suggestions = await this.suggestionRepository.findByType(type)
    const ownedSuggestions: SuggestionResponse[] = []

    for (const suggestion of suggestions) {
      if (suggestion.scope === 'story') {
        if (suggestion.storyId) {
          // Verify that the story exists and belongs to the user
          const story = await this.storyRepository.findById(suggestion.storyId, userId)
          if (story) {
            ownedSuggestions.push({
              id: suggestion.id,
              userId: suggestion.userId,
              scope: suggestion.scope,
              storyId: suggestion.storyId,
              type: suggestion.type,
              value: suggestion.value,
              createdAt: suggestion.createdAt,
              updatedAt: suggestion.updatedAt,
            })
          }
        }
      } else if (suggestion.scope === 'global') {
        if (suggestion.userId === userId) {
          ownedSuggestions.push({
            id: suggestion.id,
            userId: suggestion.userId,
            scope: suggestion.scope,
            storyId: suggestion.storyId,
            type: suggestion.type,
            value: suggestion.value,
            createdAt: suggestion.createdAt,
            updatedAt: suggestion.updatedAt,
          })
        }
      }
    }
    return ownedSuggestions
  }
}
