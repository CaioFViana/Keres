import type { Suggestion } from '@domain/entities/Suggestion'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { CreateManySuggestionsPayload, SuggestionResponse } from 'schemas'

import { ulid } from 'ulid'

export class CreateManySuggestionsUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: CreateManySuggestionsPayload): Promise<SuggestionResponse[]> {
    if (data.length === 0) {
      return []
    }

    const newSuggestions: Suggestion[] = []
    const suggestionResponses: SuggestionResponse[] = []

    for (const suggestionPayload of data) {
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

      const newSuggestion: Suggestion = {
        id: ulid(),
        userId,
        scope: suggestionPayload.scope,
        storyId: suggestionPayload.storyId || null,
        type: suggestionPayload.type,
        value: suggestionPayload.value,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      newSuggestions.push(newSuggestion)
      suggestionResponses.push({
        id: newSuggestion.id,
        userId: newSuggestion.userId,
        scope: newSuggestion.scope,
        storyId: newSuggestion.storyId,
        type: newSuggestion.type,
        value: newSuggestion.value,
        isDefault: newSuggestion.isDefault,
        createdAt: newSuggestion.createdAt,
        updatedAt: newSuggestion.updatedAt,
      })
    }

    await this.suggestionRepository.saveMany(newSuggestions)

    return suggestionResponses
  }
}
