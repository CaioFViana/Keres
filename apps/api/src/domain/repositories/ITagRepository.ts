import type { Tag } from '@domain/entities/Tag'

export interface ITagRepository {
  findById(id: string): Promise<Tag | null>
  findByStoryId(storyId: string): Promise<Tag[]>
  save(tag: Tag): Promise<void>
  update(tag: Tag): Promise<void>
  delete(id: string): Promise<void>
}
