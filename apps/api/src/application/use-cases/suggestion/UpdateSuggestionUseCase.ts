import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { SuggestionResponse, UpdateSuggestionPayload } from '@keres/shared'

export class UpdateSuggestionUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(data: UpdateSuggestionPayload): Promise<SuggestionResponse | null> {
    const existingSuggestion = await this.suggestionRepository.findById(data.id)
    if (!existingSuggestion) {
      return null // Suggestion not found
    }

    const updatedSuggestion = {
      ...existingSuggestion,
      ...data,
      updatedAt: new Date(),
    }

    await this.suggestionRepository.update(updatedSuggestion)

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
