import type { Story } from '@domain/entities/Story'
import type { ListQueryParams, PaginatedResponse } from 'schemas'

export interface IStoryRepository {
  findById(id: string, userId: string): Promise<Story | null>
  findByUserId(userId: string, query?: ListQueryParams): Promise<PaginatedResponse<Story>>
  save(story: Story): Promise<void>
  update(story: Story, userId: string): Promise<void>
  delete(id: string, userId: string): Promise<void>
  search(query: string, userId: string): Promise<Story[]>
}
