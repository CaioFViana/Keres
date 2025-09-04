import type { Tag } from '@domain/entities/Tag'

export interface ITagRepository {
  findById(id: string): Promise<Tag | null>
  findByStoryId(storyId: string): Promise<Tag[]>
  save(tag: Tag): Promise<void>
  update(tag: Tag, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
}
