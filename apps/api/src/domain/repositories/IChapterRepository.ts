import type { Chapter } from '@domain/entities/Chapter'

export interface IChapterRepository {
  findById(id: string): Promise<Chapter | null>
  findByStoryId(storyId: string): Promise<Chapter[]>
  save(chapter: Chapter): Promise<void>
  update(chapter: Chapter, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
