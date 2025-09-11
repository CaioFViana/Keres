import type { Location } from '@domain/entities/Location'
import type { ListQueryParams, PaginatedResponse } from 'schemas'

export interface ILocationRepository {
  findById(id: string): Promise<Location | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Location>>
  save(location: Location): Promise<void>
  update(location: Location, storyId: string): Promise<void>
  delete(id: string, storyId: string): Promise<void>
  search(query: string, userId: string): Promise<Location[]>
}
