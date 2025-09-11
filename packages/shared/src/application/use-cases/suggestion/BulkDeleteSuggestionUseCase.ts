import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { BulkDeleteResponse } from 'schemas'

export class BulkDeleteSuggestionUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingSuggestion = await this.suggestionRepository.findById(id)
        if (!existingSuggestion) {
          failedIds.push({ id, reason: 'Suggestion not found' })
          continue
        }

        if (existingSuggestion.scope === 'story') {
          if (!existingSuggestion.storyId) {
            failedIds.push({ id, reason: 'Story ID is missing for story-scoped suggestion' })
            continue
          }
          const story = await this.storyRepository.findById(existingSuggestion.storyId, userId)
          if (!story) {
            failedIds.push({ id, reason: 'Story not found or not owned by user' })
            continue
          }
        } else if (existingSuggestion.scope === 'global') {
          if (existingSuggestion.userId !== userId) {
            failedIds.push({
              id,
              reason: 'Unauthorized: Cannot delete global suggestion not owned by user',
            })
            continue
          }
        } else {
          failedIds.push({ id, reason: 'Invalid scope for suggestion' })
          continue
        }

        await this.suggestionRepository.delete(
          id,
          existingSuggestion.userId,
          existingSuggestion.scope,
          existingSuggestion.storyId,
        )
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
