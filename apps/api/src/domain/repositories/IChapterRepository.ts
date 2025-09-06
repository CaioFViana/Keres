import type { Chapter } from '@domain/entities/Chapter'
import type { ListQueryParams } from '@keres/shared'

export interface IChapterRepository {
  findById(id: string): Promise<Chapter | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<Chapter[]>
  save(chapter: Chapter): Promise<void>
  update(chapter: Chapter, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
