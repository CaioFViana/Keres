import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse, UpdateSuggestionPayload } from '@keres/shared'

export class UpdateSuggestionUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: UpdateSuggestionPayload): Promise<SuggestionResponse> {
    const existingSuggestion = await this.suggestionRepository.findById(data.id)
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
        throw new Error('Unauthorized: Cannot update global suggestion not owned by user')
      }
    } else {
      throw new Error('Invalid scope for suggestion')
    }

    const updatedSuggestion = {
      ...existingSuggestion,
      ...data,
      updatedAt: new Date(),
    }

    await this.suggestionRepository.update(
      updatedSuggestion,
      existingSuggestion.userId,
      existingSuggestion.scope,
      existingSuggestion.storyId,
    )

    return {
      id: updatedSuggestion.id,
      userId: updatedSuggestion.userId,
      scope: updatedSuggestion.scope,
      storyId: updatedSuggestion.storyId,
      type: updatedSuggestion.type,
      value: updatedSuggestion.value,
      createdAt: updatedSuggestion.createdAt,
      updatedAt: updatedSuggestion.updatedAt,
    }
  }
}
