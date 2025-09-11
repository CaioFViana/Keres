import type { Chapter } from '@domain/entities/Chapter'
import type { ListQueryParams, PaginatedResponse } from 'schemas'

export interface IChapterRepository {
  findById(id: string): Promise<Chapter | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Chapter>>
  save(chapter: Chapter): Promise<void>
  update(chapter: Chapter, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
  search(query: string, userId: string): Promise<Chapter[]>
}
