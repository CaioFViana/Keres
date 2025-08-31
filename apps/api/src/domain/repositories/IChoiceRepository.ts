import type { CreateChoiceDTO, UpdateChoiceDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'

export interface IChoiceRepository {
  create(data: CreateChoiceDTO): Promise<Choice>
  findById(id: string): Promise<Choice | null>
  update(id: string, data: UpdateChoiceDTO): Promise<Choice | null>
  delete(id: string): Promise<void>
  findBySceneId(sceneId: string): Promise<Choice[]>
}
