import type {
  BulkDeleteChoiceUseCase,
  CreateChoiceUseCase,
  DeleteChoiceUseCase,
  GetChoicesBySceneIdUseCase,
  GetChoiceUseCase,
  UpdateChoiceUseCase,
} from '@application/use-cases/'
import type { z } from 'zod'

import {
  ChoiceResponseSchema,
  type CreateChoiceSchema,
  type UpdateChoiceSchema,
} from '@keres/shared'

export class ChoiceController {
  constructor(
    private createChoiceUseCase: CreateChoiceUseCase,
    private getChoiceUseCase: GetChoiceUseCase,
    private updateChoiceUseCase: UpdateChoiceUseCase,
    private deleteChoiceUseCase: DeleteChoiceUseCase,
    private bulkDeleteChoiceUseCase: BulkDeleteChoiceUseCase,
    private getChoicesBySceneIdUseCase: GetChoicesBySceneIdUseCase,
  ) {}

  async createChoice(
    userId: string,
    data: z.infer<typeof CreateChoiceSchema>,
  ): Promise<z.infer<typeof ChoiceResponseSchema>> {
    const choice = await this.createChoiceUseCase.execute(userId, data)
    return ChoiceResponseSchema.parse(choice)
  }

  async getChoice(
    userId: string,
    id: string,
  ): Promise<z.infer<typeof ChoiceResponseSchema> | null> {
    const choice = await this.getChoiceUseCase.execute(userId, id)
    if (!choice) {
      return null
    }
    return ChoiceResponseSchema.parse(choice)
  }

  async updateChoice(
    userId: string,
    id: string,
    data: z.infer<typeof UpdateChoiceSchema>,
  ): Promise<z.infer<typeof ChoiceResponseSchema> | null> {
    const updatedChoice = await this.updateChoiceUseCase.execute(userId, id, data)
    if (!updatedChoice) {
      return null
    }
    return ChoiceResponseSchema.parse(updatedChoice)
  }

  async deleteChoice(userId: string, id: string): Promise<void> {
    await this.deleteChoiceUseCase.execute(userId, id)
  }

  async bulkDeleteChoices(userId: string, ids: string[]) {
    const result = await this.bulkDeleteChoiceUseCase.execute(userId, ids)
    return result
  }

  async getChoicesBySceneId(
    userId: string,
    sceneId: string,
  ): Promise<z.infer<typeof ChoiceResponseSchema>[]> {
    const choices = await this.getChoicesBySceneIdUseCase.execute(userId, sceneId)
    return choices.map((choice) => ChoiceResponseSchema.parse(choice))
  }
}
