import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { SuggestionResponse } from '@keres/shared'

export class GetSuggestionUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<SuggestionResponse> {
    const suggestion = await this.suggestionRepository.findById(id)
    if (!suggestion) {
      throw new Error('Suggestion not found')
    }

    if (suggestion.scope === 'story') {
      if (!suggestion.storyId) {
        throw new Error('Story ID is missing for story-scoped suggestion')
      }
      // Verify that the story exists and belongs to the user
      const story = await this.storyRepository.findById(suggestion.storyId, userId)
      if (!story) {
        throw new Error('Story not found or not owned by user')
      }
    } else if (suggestion.scope === 'global') {
      if (suggestion.userId !== userId) {
        throw new Error('Unauthorized: Cannot access global suggestion not owned by user')
      }
    } else {
      throw new Error('Invalid scope for suggestion')
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
