import { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository';

export class GetUniqueSuggestionTypesUseCase {
  constructor(private suggestionRepository: ISuggestionRepository) {}

  async execute(userId: string): Promise<string[]> {
    return this.suggestionRepository.getUniqueTypesByUserId(userId);
  }
}
