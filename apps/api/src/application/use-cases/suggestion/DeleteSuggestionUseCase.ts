import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteSuggestionUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingSuggestion = await this.suggestionRepository.findById(id)
    if (!existingSuggestion) {
      throw new Error('Suggestion not found')
    }

    if (existingSuggestion.scope === 'story') {
      if (!existingSuggestion.storyId) {
        throw new Error('Story ID is missing for story-scoped suggestion')
      }
      // Verify that the story exists and belongs to the user
      const story = await this.storyRepository.findById(existingSuggestion.storyId, userId)
      if (!story) {
        throw new Error('Story not found or not owned by user')
      }
    } else if (existingSuggestion.scope === 'global') {
      if (existingSuggestion.userId !== userId) {
        throw new Error('Unauthorized: Cannot delete global suggestion not owned by user')
      }
    } else {
      throw new Error('Invalid scope for suggestion')
    }

    await this.suggestionRepository.delete(
      id,
      existingSuggestion.userId,
      existingSuggestion.scope,
      existingSuggestion.storyId,
    )
    return true
  }
}
