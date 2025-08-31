import type {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type CreateMomentSchema, // Renamed
  MomentResponseSchema,
  type UpdateMomentSchema, // Renamed
} from '@keres/shared'

export class MomentController {
  constructor(
    private readonly createMomentUseCase: CreateMomentUseCase,
    private readonly getMomentUseCase: GetMomentUseCase,
    private readonly updateMomentUseCase: UpdateMomentUseCase,
    private readonly deleteMomentUseCase: DeleteMomentUseCase,
    private readonly getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase,
  ) {}

  async createMoment(data: z.infer<typeof CreateMomentSchema>) {
    const moment = await this.createMomentUseCase.execute(data)
    return MomentResponseSchema.parse(moment)
  }

  async getMoment(id: string) {
    const moment = await this.getMomentUseCase.execute(id)
    if (!moment) {
      throw new Error('Moment not found')
    }
    return MomentResponseSchema.parse(moment)
  }

  async getMomentsBySceneId(sceneId: string) {
    const moments = await this.getMomentsBySceneIdUseCase.execute(sceneId)
    return moments.map((moment) => MomentResponseSchema.parse(moment))
  }

  async updateMoment(id: string, data: z.infer<typeof UpdateMomentSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedMoment = await this.updateMomentUseCase.execute({ id, ...updateData })
    if (!updatedMoment) {
      throw new Error('Moment not found') // Simplified error message
    }
    return MomentResponseSchema.parse(updatedMoment)
  }

  async deleteMoment(id: string) {
    const deleted = await this.deleteMomentUseCase.execute(id)
    if (!deleted) {
      throw new Error('Moment not found') // Simplified error message
    }
    return
  }
}
