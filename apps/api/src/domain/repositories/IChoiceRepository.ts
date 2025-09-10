import type { Choice } from '@domain/entities/Choice'
import type { CreateChoicePayload, UpdateChoicePayload } from '@keres/shared'

export interface IChoiceRepository {
  create(data: CreateChoicePayload): Promise<Choice>
  findById(id: string): Promise<Choice | null>
  update(id: string, data: UpdateChoicePayload, sceneId: string): Promise<Choice | null>
  delete(id: string, sceneId: string): Promise<void>
  findBySceneId(sceneId: string): Promise<Choice[]>
  search(query: string, userId: string): Promise<Choice[]>
}
