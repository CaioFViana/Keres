import type { Moment } from '@domain/entities/Moment'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

export interface IMomentRepository {
  findById(id: string): Promise<Moment | null>
  findByIds(ids: string[]): Promise<Moment[]>
  findBySceneId(sceneId: string, query?: ListQueryParams): Promise<PaginatedResponse<Moment>>
  save(moment: Moment): Promise<void>
  saveMany(moments: Moment[]): Promise<void>
  update(moment: Moment, sceneId: string): Promise<void>
  updateMany(moments: Moment[]): Promise<void>
  delete(id: string, sceneId: string): Promise<void>
  search(query: string, userId: string): Promise<Moment[]>
}
