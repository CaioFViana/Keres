import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'

export class DeleteSuggestionUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(id: string): Promise<boolean> {
    const existingSuggestion = await this.suggestionRepository.findById(id)
    if (!existingSuggestion) {
      return false // Suggestion not found
    }
    await this.suggestionRepository.delete(id)
    return true
  }
}
