import type { Suggestion } from '@domain/entities/Suggestion'
import type { ListQueryParams, PaginatedResponse } from 'schemas'

export interface ISuggestionRepository {
  findById(id: string): Promise<Suggestion | null>
  findByUserId(userId: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>>
  findByType(type: string, userId: string, storyId: string | null, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> // For global suggestions of a type
  findByUserAndType(userId: string, type: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> // For user-specific global suggestions
  findByStoryAndType(storyId: string, type: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> // For story-specific suggestions
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
