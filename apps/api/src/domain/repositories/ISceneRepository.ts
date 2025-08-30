import type { Scene } from '@domain/entities/Scene'

export interface ISceneRepository {
  findById(id: string): Promise<Scene | null>
  findByChapterId(chapterId: string): Promise<Scene[]>
  save(scene: Scene): Promise<void>
  update(scene: Scene): Promise<void>
  delete(id: string): Promise<void>
}
