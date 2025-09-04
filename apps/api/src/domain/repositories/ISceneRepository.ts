import type { Scene } from '@domain/entities/Scene'

export interface ISceneRepository {
  findById(id: string): Promise<Scene | null>
  findByChapterId(chapterId: string): Promise<Scene[]>
  save(scene: Scene): Promise<void>
  update(scene: Scene, chapterId: string): Promise<void>
  delete(id: string, chapterId: string): Promise<void>
}
