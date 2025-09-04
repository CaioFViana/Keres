import type { Story } from '@domain/entities/Story'

export interface IStoryRepository {
  findById(id: string, userId: string): Promise<Story | null>
  findByUserId(userId: string): Promise<Story[]>
  save(story: Story): Promise<void>
  update(story: Story, userId: string): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
