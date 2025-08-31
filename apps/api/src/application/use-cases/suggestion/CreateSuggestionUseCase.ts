import type { Suggestion } from '@domain/entities/Suggestion';
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository';
import type { CreateSuggestionPayload, SuggestionResponse } from '@keres/shared';

import { ulid } from 'ulid';

export class CreateSuggestionUseCase {
  constructor(private readonly suggestionRepository: ISuggestionRepository) {}

  async execute(data: CreateSuggestionPayload): Promise<SuggestionResponse> {
    const newSuggestion: Suggestion = {
      id: ulid(),
      userId: data.userId,
      scope: data.scope,
      storyId: data.storyId || null,
      type: data.type,
      value: data.value,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.suggestionRepository.save(newSuggestion);

    return {
      id: newSuggestion.id,
      userId: newSuggestion.userId,
      scope: newSuggestion.scope,
      storyId: newSuggestion.storyId,
      type: newSuggestion.type,
      value: newSuggestion.value,
      createdAt: newSuggestion.createdAt,
      updatedAt: newSuggestion.updatedAt,
    };
  }
}