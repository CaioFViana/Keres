import type { WorldRule } from '@domain/entities/WorldRule'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

export interface IWorldRuleRepository {
  findById(id: string): Promise<WorldRule | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<WorldRule>>
  save(worldRule: WorldRule): Promise<void>
  update(worldRule: WorldRule, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
  search(query: string, userId: string): Promise<WorldRule[]>
}
