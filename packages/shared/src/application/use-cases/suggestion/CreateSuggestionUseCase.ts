import type { Suggestion } from '@domain/entities/Suggestion'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { CreateSuggestionPayload, SuggestionResponse } from 'schemas'

import { ulid } from 'ulid'

export class CreateSuggestionUseCase {
  constructor(
    private readonly suggestionRepository: ISuggestionRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CreateSuggestionPayload): Promise<SuggestionResponse> {
    // Enforce that the userId in the payload matches the authenticated userId
    if (data.userId !== userId) {
      throw new Error('Unauthorized: Cannot create suggestion for another user')
    }

    if (data.scope === 'story') {
      if (!data.storyId) {
        throw new Error('Story ID is required for story-scoped suggestions')
      }
      // Verify that the story exists and belongs to the user
      const story = await this.storyRepository.findById(data.storyId, userId)
      if (!story) {
        throw new Error('Story not found or not owned by user')
      }
    } else if (data.scope === 'global') {
      if (data.storyId !== null) {
        throw new Error('Story ID must be null for global-scoped suggestions')
      }
    } else {
      throw new Error('Invalid scope provided. Must be "story" or "global"')
    }

    const newSuggestion: Suggestion = {
      id: ulid(),
      userId: data.userId,
      scope: data.scope,
      storyId: data.storyId || null,
      type: data.type,
      value: data.value,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.suggestionRepository.save(newSuggestion)

    return {
      id: newSuggestion.id,
      userId: newSuggestion.userId,
      scope: newSuggestion.scope,
      storyId: newSuggestion.storyId,
      type: newSuggestion.type,
      value: newSuggestion.value,
      isDefault: newSuggestion.isDefault,
      createdAt: newSuggestion.createdAt,
      updatedAt: newSuggestion.updatedAt,
    }
  }
}
