import type { Scene } from '@domain/entities/Scene'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

export interface ISceneRepository {
  findById(id: string): Promise<Scene | null>
  findByChapterId(chapterId: string, query?: ListQueryParams): Promise<PaginatedResponse<Scene>>
  findByLocationId(locationId: string, query?: ListQueryParams): Promise<PaginatedResponse<Scene>> // New
  save(scene: Scene): Promise<void>
  update(scene: Scene, chapterId: string): Promise<void>
  delete(id: string, chapterId: string): Promise<void>
  search(query: string, userId: string): Promise<Scene[]>
}
