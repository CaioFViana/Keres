import type { Moment } from '@domain/entities/Moment'

export interface IMomentRepository {
  findById(id: string): Promise<Moment | null>
  findBySceneId(sceneId: string): Promise<Moment[]>
  save(moment: Moment): Promise<void>
  update(moment: Moment, sceneId: string): Promise<void>
  delete(id: string, sceneId: string): Promise<void>
}
