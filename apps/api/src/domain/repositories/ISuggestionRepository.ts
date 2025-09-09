import type { Suggestion } from '@domain/entities/Suggestion'

export interface ISuggestionRepository {
  findById(id: string): Promise<Suggestion | null>
  findByUserId(userId: string): Promise<Suggestion[]>
  findByStoryId(storyId: string): Promise<Suggestion[]>
  findByType(type: string): Promise<Suggestion[]> // For global suggestions of a type
  findByUserAndType(userId: string, type: string): Promise<Suggestion[]> // For user-specific global suggestions
  findByStoryAndType(storyId: string, type: string): Promise<Suggestion[]> // For story-specific suggestions
  save(suggestion: Suggestion): Promise<void>
  saveMany(suggestions: Suggestion[]): Promise<void>
  update(
    suggestion: Suggestion,
    userId: string,
    scope: string,
    storyId: string | null,
  ): Promise<void>
  updateMany(suggestions: Suggestion[]): Promise<void>
  delete(id: string, userId: string, scope: string, storyId: string | null): Promise<void>
  search(query: string, userId: string): Promise<Suggestion[]>
}
