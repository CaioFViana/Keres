import type { Scene } from '@domain/entities/Scene'
import type { ListQueryParams } from '@keres/shared'

export interface ISceneRepository {
  findById(id: string): Promise<Scene | null>
  findByChapterId(chapterId: string, query?: ListQueryParams): Promise<Scene[]>
  save(scene: Scene): Promise<void>
  update(scene: Scene, chapterId: string): Promise<void>
  delete(id: string, chapterId: string): Promise<void>
}
